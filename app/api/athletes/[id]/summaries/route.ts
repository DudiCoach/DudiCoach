import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import {
  getCycleSummaries,
  createCycleSummary,
} from "@/lib/data/cycle-summary";
import { cycleSummarySchema } from "@/lib/validation/cycle-summary";
import { getAthleteById } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/athletes/[id]/summaries
 * List all cycle summaries for an athlete.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id: athleteId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "GET /api/athletes/[id]/summaries",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const summaries = await getCycleSummaries(athleteId);
    return NextResponse.json({ data: summaries });
  } catch (error) {
    console.error("[GET /api/athletes/[id]/summaries] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/athletes/[id]/summaries
 * Create a new cycle summary.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: athleteId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "POST /api/athletes/[id]/summaries",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = cycleSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const summary = await createCycleSummary(athleteId, parsed.data);
    return NextResponse.json({ data: summary }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athletes/[id]/summaries] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
