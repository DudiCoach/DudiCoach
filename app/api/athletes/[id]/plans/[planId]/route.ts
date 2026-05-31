import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { archiveTrainingPlan, activateTrainingPlan, duplicateTrainingPlan } from "@/lib/data/training-plan";
import { getAthleteById } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string; planId: string }> };

/**
 * PATCH /api/athletes/[id]/plans/[planId]
 * Update plan status (archive/activate).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id: athleteId, planId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "PATCH /api/athletes/[id]/plans/[planId]",
  );
  if (response) return response;

  try {
    // Verify athlete ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { action } = body;

    if (action === "archive") {
      await archiveTrainingPlan(athleteId, planId);
      return NextResponse.json({ success: true });
    }

    if (action === "activate") {
      await activateTrainingPlan(athleteId, planId);
      return NextResponse.json({ success: true });
    }

    if (action === "duplicate") {
      const newName = (body.plan_name as string) ?? "Kopia planu";
      const newPlan = await duplicateTrainingPlan(athleteId, planId, newName);
      return NextResponse.json({ data: newPlan }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[PATCH /api/athletes/[id]/plans/[planId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
