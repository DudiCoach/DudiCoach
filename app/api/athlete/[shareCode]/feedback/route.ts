import { NextRequest, NextResponse } from "next/server";

import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getLatestPlanByShareCode } from "@/lib/data/training-plan";
import {
  upsertSessionFeedback,
  getSessionFeedbackByShareCode,
  validatePlanDay,
} from "@/lib/data/session-feedback";
import { publicSessionFeedbackSchema } from "@/lib/validation/session-feedback";

type RouteContext = { params: Promise<{ shareCode: string }> };

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * GET /api/athlete/[shareCode]/feedback
 * Public endpoint. Returns all feedback for a plan by share code.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
    }

    // Validate share code
    const athlete = await getAthleteByShareCode(normalized);
    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get feedback
    const feedback = await getSessionFeedbackByShareCode(normalized, planId);

    return NextResponse.json({ data: feedback });
  } catch (error) {
    console.error("[GET /api/athlete/[shareCode]/feedback] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/athlete/[shareCode]/feedback
 * Public endpoint. Creates or updates feedback for a specific day.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Validate share code
    const athlete = await getAthleteByShareCode(normalized);
    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = publicSessionFeedbackSchema.safeParse({
      ...body,
      share_code: normalized,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { plan_id, week_number, day_number, feedback_text } = parsed.data;

    // Get the plan to validate week/day
    const plan = await getLatestPlanByShareCode(normalized);
    if (!plan || plan.id !== plan_id) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 },
      );
    }

    // Validate that the week/day exists in the plan
    if (!validatePlanDay(plan.plan_json, week_number, day_number)) {
      return NextResponse.json(
        { error: "Invalid week or day number for this plan" },
        { status: 400 },
      );
    }

    // Upsert the feedback
    const feedback = await upsertSessionFeedback(
      athlete.id,
      plan_id,
      week_number,
      day_number,
      feedback_text,
    );

    return NextResponse.json({ data: feedback }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athlete/[shareCode]/feedback] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
