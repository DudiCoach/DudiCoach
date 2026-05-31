import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { getAthleteById } from "@/lib/data/athlete";
import { getTrainingPlans } from "@/lib/data/training-plan";
import { getDb } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string; planId: string }> };

/**
 * GET /api/athletes/[id]/plans/[planId]/feedback
 * Authenticated coach endpoint for reading all day-level feedback rows
 * for one concrete athlete plan.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id, planId } = await params;

  const { response } = await requireAuth("GET /api/athletes/[id]/plans/[planId]/feedback");
  if (response) return response;

  // Verify athlete exists
  const athlete = await getAthleteById(id);
  if (!athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify plan exists and belongs to this athlete
  const plans = await getTrainingPlans(id);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch feedback from Firestore
  const snapshot = await getDb()
    .collection("athletes")
    .doc(id)
    .collection("session_feedback")
    .where("planId", "==", planId)
    .orderBy("weekNumber", "asc")
    .orderBy("dayNumber", "asc")
    .get();

  const data = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      plan_id: d.planId,
      athlete_id: id,
      week_number: d.weekNumber,
      day_number: d.dayNumber,
      feedback_text: d.feedbackText,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    };
  });

  return NextResponse.json({ data });
}
