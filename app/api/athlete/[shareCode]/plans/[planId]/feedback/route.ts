import { NextRequest, NextResponse } from "next/server";

import {
  feedbackPlanIdSchema,
  publicFeedbackPostBodySchema,
  publicFeedbackQuerySchema,
  shareCodePathSchema,
} from "@/lib/validation/plan-session-feedback";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ shareCode: string; planId: string }> };
type SupabaseErrorLike = { code?: string; message?: string } | null;

type PlanSessionFeedbackRow = {
  id: string;
  plan_id: string;
  athlete_id: string;
  week_number: number;
  day_number: number;
  feedback_text: string;
  created_at: string;
  updated_at: string;
};

function isValidationError(error: SupabaseErrorLike) {
  return error?.code === "22023";
}

function isNotFoundLikeError(error: SupabaseErrorLike) {
  return error?.code === "P0001";
}

function toFeedbackRow(data: unknown): PlanSessionFeedbackRow | null {
  const rows = (data as PlanSessionFeedbackRow[] | null) ?? null;
  return rows?.[0] ?? null;
}

/**
 * POST /api/athlete/[shareCode]/plans/[planId]/feedback
 * Public athlete endpoint for upserting day-level feedback.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { shareCode, planId } = await params;

  const parsedShareCode = shareCodePathSchema.safeParse(shareCode);
  if (!parsedShareCode.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsedPlanId = feedbackPlanIdSchema.safeParse(planId);
  if (!parsedPlanId.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = publicFeedbackPostBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_plan_session_feedback", {
    p_code: parsedShareCode.data,
    p_plan_id: parsedPlanId.data,
    p_week_number: parsedBody.data.weekNumber,
    p_day_number: parsedBody.data.dayNumber,
    p_feedback_text: parsedBody.data.feedbackText,
  });

  if (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    if (isNotFoundLikeError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    console.error("[POST /api/athlete/[shareCode]/plans/[planId]/feedback] RPC error", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const row = toFeedbackRow(data);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: row });
}

/**
 * GET /api/athlete/[shareCode]/plans/[planId]/feedback
 * Public athlete endpoint for one day-level feedback row.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { shareCode, planId } = await params;

  const parsedShareCode = shareCodePathSchema.safeParse(shareCode);
  if (!parsedShareCode.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsedPlanId = feedbackPlanIdSchema.safeParse(planId);
  if (!parsedPlanId.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsedQuery = publicFeedbackQuerySchema.safeParse({
    weekNumber: url.searchParams.get("weekNumber"),
    dayNumber: url.searchParams.get("dayNumber"),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsedQuery.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_plan_session_feedback_by_share_code",
    {
      p_code: parsedShareCode.data,
      p_plan_id: parsedPlanId.data,
      p_week_number: parsedQuery.data.weekNumber,
      p_day_number: parsedQuery.data.dayNumber,
    },
  );

  if (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    if (isNotFoundLikeError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    console.error("[GET /api/athlete/[shareCode]/plans/[planId]/feedback] RPC error", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const row = toFeedbackRow(data);
  return NextResponse.json({ data: row ?? null });
}
