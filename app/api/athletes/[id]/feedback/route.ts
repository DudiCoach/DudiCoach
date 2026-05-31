import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getSessionFeedbackByPlan } from "@/lib/data/session-feedback";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/athletes/[id]/feedback
 * Coach-only endpoint. Returns all feedback for an athlete's plan.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id: athleteId } = await params;

  // session cookie auth
  const { response } = await requireAuth("GET /api/athletes/[id]/feedback");
  if (response) return response;

  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
    }

    // Get feedback
    const feedback = await getSessionFeedbackByPlan(athleteId, planId);

    return NextResponse.json({ data: feedback });
  } catch (error) {
    console.error("[GET /api/athletes/[id]/feedback] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
