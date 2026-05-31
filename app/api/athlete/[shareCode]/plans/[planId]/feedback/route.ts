import { NextRequest, NextResponse } from "next/server";

import {
  feedbackPlanIdSchema,
  publicFeedbackPostBodySchema,
  publicFeedbackQuerySchema,
  shareCodePathSchema,
} from "@/lib/validation/plan-session-feedback";
import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getTrainingPlans } from "@/lib/data/training-plan";
import { upsertSessionFeedback, getSessionFeedbackByDay } from "@/lib/data/session-feedback";

type RouteContext = { params: Promise<{ shareCode: string; planId: string }> };

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

  // Resolve athlete from share code
  const athlete = await getAthleteByShareCode(parsedShareCode.data);
  if (!athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify plan belongs to this athlete
  const plans = await getTrainingPlans(athlete.id);
  const plan = plans.find((p) => p.id === parsedPlanId.data);
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Upsert feedback
  const row = await upsertSessionFeedback(
    athlete.id,
    parsedPlanId.data,
    parsedBody.data.weekNumber,
    parsedBody.data.dayNumber,
    parsedBody.data.feedbackText,
  );

  return NextResponse.json({
    data: {
      id: row.id,
      plan_id: parsedPlanId.data,
      athlete_id: athlete.id,
      week_number: row.week_number,
      day_number: row.day_number,
      feedback_text: row.feedback_text,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
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

  // Resolve athlete from share code
  const athlete = await getAthleteByShareCode(parsedShareCode.data);
  if (!athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get feedback for this specific day
  const feedback = await getSessionFeedbackByDay(
    athlete.id,
    parsedPlanId.data,
    parsedQuery.data.weekNumber,
    parsedQuery.data.dayNumber,
  );

  if (!feedback) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: feedback.id,
      plan_id: parsedPlanId.data,
      athlete_id: athlete.id,
      week_number: feedback.week_number,
      day_number: feedback.day_number,
      feedback_text: feedback.feedback_text,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
    },
  });
}
