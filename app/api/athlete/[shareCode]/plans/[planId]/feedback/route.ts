import { NextRequest, NextResponse } from "next/server";

import {
  feedbackPlanIdSchema,
  publicFeedbackPostBodySchema,
  publicFeedbackQuerySchema,
  shareCodePathSchema,
  type PublicFeedbackPostBody,
} from "@/lib/validation/plan-session-feedback";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ shareCode: string; planId: string }> };
type SupabaseErrorLike = {
  code?: string;
  hint?: string;
  message?: string;
} | null;

type PlanSessionFeedbackRow = {
  id: string;
  plan_id: string;
  athlete_id: string;
  week_number: number;
  day_number: number;
  feedback_text?: string | null;
  session_date?: string | null;
  session_status?: string | null;
  session_rpe?: number | null;
  wellbeing?: number | null;
  pain_score?: number | null;
  pain_location?: string | null;
  pain_side?: string | null;
  created_at: string;
  updated_at: string;
};

type PublicPlanSessionFeedbackRow = Omit<PlanSessionFeedbackRow, "athlete_id">;
type PublicFeedbackV2PostBody = Extract<
  PublicFeedbackPostBody,
  { contractVersion: 2 }
>;
function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function isPublicFeedbackV2PostBody(
  body: PublicFeedbackPostBody,
): body is PublicFeedbackV2PostBody {
  return "contractVersion" in body && body.contractVersion === 2;
}

function isValidationError(error: SupabaseErrorLike) {
  return error?.code === "22023" || error?.code === "22007";
}

function isCheckViolationError(error: SupabaseErrorLike) {
  return error?.code === "23514";
}

function isNotFoundLikeError(error: SupabaseErrorLike) {
  return error?.code === "P0001";
}

function isRateLimitError(error: SupabaseErrorLike) {
  return error?.code === "PT429";
}

function retryAfterFromHint(hint: string | undefined) {
  const value = Number(hint);
  if (!Number.isFinite(value) || value < 1) return "600";
  return String(Math.ceil(value));
}

function toFeedbackRow(data: unknown): PublicPlanSessionFeedbackRow | null {
  const rows = (data as PlanSessionFeedbackRow[] | null) ?? null;
  const row = rows?.[0] ?? null;
  if (!row) return null;

  return {
    id: row.id,
    plan_id: row.plan_id,
    week_number: row.week_number,
    day_number: row.day_number,
    feedback_text: row.feedback_text ?? null,
    session_date: row.session_date ?? null,
    session_status: row.session_status ?? null,
    session_rpe: row.session_rpe ?? null,
    wellbeing: row.wellbeing ?? null,
    pain_score: row.pain_score ?? null,
    pain_location: row.pain_location ?? null,
    pain_side: row.pain_side ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rateLimitResponse(error: SupabaseErrorLike) {
  return jsonNoStore(
    { error: "Rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterFromHint(error?.hint),
      },
    },
  );
}

/**
 * POST /api/athlete/[shareCode]/plans/[planId]/feedback
 * Public athlete endpoint for upserting day-level feedback.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { shareCode, planId } = await params;

  const parsedShareCode = shareCodePathSchema.safeParse(shareCode);
  if (!parsedShareCode.success) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const parsedPlanId = feedbackPlanIdSchema.safeParse(planId);
  if (!parsedPlanId.success) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = publicFeedbackPostBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return jsonNoStore({ error: "Validation failed" }, { status: 400 });
  }

  const body: PublicFeedbackPostBody = parsedBody.data;
  const supabase = await createClient();
  const { data, error } = isPublicFeedbackV2PostBody(body)
    ? await supabase.rpc("upsert_plan_session_feedback_v2", {
        p_code: parsedShareCode.data,
        p_plan_id: parsedPlanId.data,
        p_week_number: body.weekNumber,
        p_day_number: body.dayNumber,
        p_session_date: body.outcome.sessionDate,
        p_session_status: body.outcome.sessionStatus,
        p_wellbeing: body.outcome.wellbeing,
        p_pain_score: body.outcome.painScore,
        p_session_rpe: body.outcome.sessionRpe,
        p_pain_location: body.outcome.painLocation,
        p_pain_side: body.outcome.painSide,
        p_feedback_text: body.feedbackText,
      })
    : await supabase.rpc("upsert_plan_session_feedback", {
        p_code: parsedShareCode.data,
        p_plan_id: parsedPlanId.data,
        p_week_number: body.weekNumber,
        p_day_number: body.dayNumber,
        p_feedback_text: body.feedbackText,
      });

  if (error) {
    if (isRateLimitError(error)) {
      return rateLimitResponse(error);
    }
    if (isValidationError(error) || isCheckViolationError(error)) {
      return jsonNoStore({ error: "Validation failed" }, { status: 400 });
    }
    if (isNotFoundLikeError(error)) {
      return jsonNoStore({ error: "Not found" }, { status: 404 });
    }

    console.error(
      "[POST /api/athlete/[shareCode]/plans/[planId]/feedback] RPC error",
      {
        code: error.code,
      },
    );
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  const row = toFeedbackRow(data);
  if (!row) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  // Personalized data gated by share code: never cache.
  return jsonNoStore({ data: row });
}

/**
 * GET /api/athlete/[shareCode]/plans/[planId]/feedback
 * Public athlete endpoint for one day-level feedback row.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { shareCode, planId } = await params;

  const parsedShareCode = shareCodePathSchema.safeParse(shareCode);
  if (!parsedShareCode.success) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const parsedPlanId = feedbackPlanIdSchema.safeParse(planId);
  if (!parsedPlanId.success) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsedQuery = publicFeedbackQuerySchema.safeParse({
    weekNumber: url.searchParams.get("weekNumber"),
    dayNumber: url.searchParams.get("dayNumber"),
    contractVersion: url.searchParams.get("contractVersion"),
  });

  if (!parsedQuery.success) {
    return jsonNoStore({ error: "Validation failed" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    parsedQuery.data.contractVersion === 2
      ? "get_plan_session_feedback_by_share_code_v2"
      : "get_plan_session_feedback_by_share_code",
    {
      p_code: parsedShareCode.data,
      p_plan_id: parsedPlanId.data,
      p_week_number: parsedQuery.data.weekNumber,
      p_day_number: parsedQuery.data.dayNumber,
    },
  );

  if (error) {
    if (isValidationError(error)) {
      return jsonNoStore({ error: "Validation failed" }, { status: 400 });
    }
    if (isNotFoundLikeError(error)) {
      return jsonNoStore({ error: "Not found" }, { status: 404 });
    }

    console.error(
      "[GET /api/athlete/[shareCode]/plans/[planId]/feedback] RPC error",
      {
        code: error.code,
      },
    );
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  const row = toFeedbackRow(data);
  // Personalized data gated by share code: never cache.
  return jsonNoStore({ data: row ?? null });
}
