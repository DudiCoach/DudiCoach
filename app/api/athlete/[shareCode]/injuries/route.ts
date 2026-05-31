import { NextRequest, NextResponse } from "next/server";

import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getInjuries } from "@/lib/data/injury";

type RouteContext = { params: Promise<{ shareCode: string }> };

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * GET /api/athlete/[shareCode]/injuries
 * Public endpoint used by the athlete panel.
 * Returns active injuries for the athlete via Firestore.
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
    // Validate share code
    const athlete = await getAthleteByShareCode(normalized);

    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get injuries
    const injuries = await getInjuries(athlete.id);

    // Filter to active injuries only (for public view)
    const activeInjuries = injuries.filter((injury) => injury.status === "active");

    return NextResponse.json({ data: activeInjuries });
  } catch (error) {
    console.error("[GET /api/athlete/[shareCode]/injuries] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
