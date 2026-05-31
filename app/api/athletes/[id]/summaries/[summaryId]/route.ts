import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import {
  getCycleSummaryById,
  updateCycleSummary,
  deleteCycleSummary,
} from "@/lib/data/cycle-summary";
import { updateCycleSummarySchema } from "@/lib/validation/cycle-summary";
import { getAthleteById } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string; summaryId: string }> };

/**
 * GET /api/athletes/[id]/summaries/[summaryId]
 * Get a cycle summary by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id: athleteId, summaryId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "GET /api/athletes/[id]/summaries/[summaryId]",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const summary = await getCycleSummaryById(athleteId, summaryId);
    if (!summary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("[GET /api/athletes/[id]/summaries/[summaryId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/athletes/[id]/summaries/[summaryId]
 * Update a cycle summary.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id: athleteId, summaryId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "PATCH /api/athletes/[id]/summaries/[summaryId]",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if summary exists
    const existing = await getCycleSummaryById(athleteId, summaryId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateCycleSummarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    await updateCycleSummary(athleteId, summaryId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/athletes/[id]/summaries/[summaryId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/athletes/[id]/summaries/[summaryId]
 * Delete a cycle summary.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id: athleteId, summaryId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "DELETE /api/athletes/[id]/summaries/[summaryId]",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if summary exists
    const existing = await getCycleSummaryById(athleteId, summaryId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteCycleSummary(athleteId, summaryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/athletes/[id]/summaries/[summaryId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
