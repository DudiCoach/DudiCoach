import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import {
  feedbackAthleteIdSchema,
  feedbackPlanIdSchema,
} from "@/lib/validation/plan-session-feedback";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string; planId: string }> };
type SupabaseErrorLike = { code?: string; message?: string } | null;

const NOT_FOUND_ERROR_CODE = "PGRST116";

function isNotFoundError(error: SupabaseErrorLike) {
  return error?.code === NOT_FOUND_ERROR_CODE;
}

/**
 * GET /api/athletes/[id]/plans/[planId]/feedback
 * Authenticated coach endpoint for reading all day-level feedback rows
 * for one concrete athlete plan.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id, planId } = await params;

  const parsedAthleteId = feedbackAthleteIdSchema.safeParse(id);
  const parsedPlanId = feedbackPlanIdSchema.safeParse(planId);
  if (!parsedAthleteId.success || !parsedPlanId.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { response } = await requireAuth(
    supabase,
    "GET /api/athletes/[id]/plans/[planId]/feedback",
  );
  if (response) return response;

  const { data: athlete, error: athleteError } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", parsedAthleteId.data)
    .single();

  if (athleteError) {
    if (isNotFoundError(athleteError)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(
      "[GET /api/athletes/[id]/plans/[planId]/feedback] Athlete lookup failed",
      {
        code: athleteError.code,
        message: athleteError.message,
      },
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id")
    .eq("id", parsedPlanId.data)
    .eq("athlete_id", parsedAthleteId.data)
    .single();

  if (planError) {
    if (isNotFoundError(planError)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(
      "[GET /api/athletes/[id]/plans/[planId]/feedback] Plan lookup failed",
      {
        code: planError.code,
        message: planError.message,
      },
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("plan_session_feedback")
    .select(
      "id, plan_id, athlete_id, week_number, day_number, feedback_text, created_at, updated_at",
    )
    .eq("athlete_id", parsedAthleteId.data)
    .eq("plan_id", parsedPlanId.data)
    .order("week_number", { ascending: true })
    .order("day_number", { ascending: true });

  if (error) {
    console.error(
      "[GET /api/athletes/[id]/plans/[planId]/feedback] Feedback query failed",
      {
        code: error.code,
        message: error.message,
      },
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
