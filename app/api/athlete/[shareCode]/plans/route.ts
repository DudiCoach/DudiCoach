import { NextRequest, NextResponse } from "next/server";

import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getLatestPlanByShareCode } from "@/lib/data/training-plan";

type RouteContext = { params: Promise<{ shareCode: string }> };

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * GET /api/athlete/[shareCode]/plans
 * Public endpoint used by the athlete panel.
 * Returns the most recent training plan via Firestore.
 * Returns { data: PublicTrainingPlan } when a plan exists, or { data: null } when
 * the code is valid+active but the athlete has no plan yet.
 * Returns 404 for malformed, nonexistent, or inactive share codes.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // First gate: validate that the share code resolves to an active athlete.
    const athlete = await getAthleteByShareCode(normalized);

    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get the latest plan
    const plan = await getLatestPlanByShareCode(normalized);

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("[GET /api/athlete/[shareCode]/plans] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
