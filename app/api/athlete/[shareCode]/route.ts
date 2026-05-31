import { NextRequest, NextResponse } from "next/server";

import { getAthleteByShareCode } from "@/lib/data/athlete";

// Next.js 16: params is a Promise — must be awaited.
type RouteContext = { params: Promise<{ shareCode: string }> };

// 6 uppercase alphanumeric chars, with ambiguous characters excluded
// (matches generate_share_code() alphabet in US-002 migration).
const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * GET /api/athlete/[shareCode]
 * Public (no auth). Fetches a sanitized athlete profile via Firestore.
 * Returns 404 when:
 *   • share code format is invalid
 *   • no athlete has this code
 *   • the athlete's share_active is false
 *
 * The share code itself is the access credential — see ADR-0003.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { shareCode } = await params;

  const normalized = shareCode.toUpperCase();
  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const athlete = await getAthleteByShareCode(normalized);

    if (!athlete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if share is active
    if (!athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return sanitized data (no coach_id)
    const sanitized = {
      id: athlete.id,
      name: athlete.name,
      age: athlete.age,
      weight_kg: athlete.weight_kg,
      height_cm: athlete.height_cm,
      sport: athlete.sport,
      training_start_date: athlete.training_start_date,
      training_days_per_week: athlete.training_days_per_week,
      session_minutes: athlete.session_minutes,
      current_phase: athlete.current_phase,
      goal: athlete.goal,
      notes: athlete.notes,
      share_code: athlete.share_code,
      share_active: athlete.share_active,
      created_at: athlete.created_at,
      updated_at: athlete.updated_at,
    };
    return NextResponse.json({ data: sanitized });
  } catch (error) {
    console.error("[GET /api/athlete/[shareCode]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
