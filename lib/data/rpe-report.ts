import { getDb } from "@/lib/firebase/admin";
import { getAthleteByShareCode as fbGetByShareCode } from "@/lib/firebase/admin";
import { getTrainingPlans as fbGetPlans } from "@/lib/firebase/admin";

// =============================================================================
// TYPES
// =============================================================================

export interface RpeReport {
  id: string;
  athlete_id: string;
  plan_id: string;
  week_number: number;
  day_number: number;
  rpe: number;
  pain_level: number | null;
  pain_location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FirestoreRpeReport {
  athleteId: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
  rpe: number;
  painLevel: number | null;
  painLocation: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, doc: FirestoreRpeReport): RpeReport {
  return {
    id,
    athlete_id: doc.athleteId,
    plan_id: doc.planId,
    week_number: doc.weekNumber,
    day_number: doc.dayNumber,
    rpe: doc.rpe,
    pain_level: doc.painLevel,
    pain_location: doc.painLocation,
    notes: doc.notes,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ATHLETES = "athletes";
const RPE_COLLECTION = "rpe_reports";

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all RPE reports for a plan.
 */
export async function getRpeReportsByPlan(
  athleteId: string,
  planId: string,
): Promise<RpeReport[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(RPE_COLLECTION)
    .where("planId", "==", planId)
    .orderBy("weekNumber", "asc")
    .orderBy("dayNumber", "asc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreRpeReport));
}

/**
 * Get RPE report for a specific day.
 */
export async function getRpeReportByDay(
  athleteId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
): Promise<RpeReport | null> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(RPE_COLLECTION)
    .where("planId", "==", planId)
    .where("weekNumber", "==", weekNumber)
    .where("dayNumber", "==", dayNumber)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return toResponse(doc.id, doc.data() as FirestoreRpeReport);
}

/**
 * Get RPE reports by share code (public endpoint).
 */
export async function getRpeReportsByShareCode(
  shareCode: string,
  planId: string,
): Promise<RpeReport[]> {
  const athlete = await fbGetByShareCode(shareCode);
  if (!athlete) return [];

  const plans = await fbGetPlans(athlete.id);
  const planExists = plans.some((p) => p.id === planId);
  if (!planExists) return [];

  return getRpeReportsByPlan(athlete.id, planId);
}

/**
 * Upsert RPE report for a specific day.
 */
export async function upsertRpeReport(
  athleteId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
  data: {
    rpe: number;
    pain_level?: number;
    pain_location?: string;
    notes?: string;
  },
): Promise<RpeReport> {
  const now = new Date().toISOString();

  // Check if report already exists
  const existing = await getRpeReportByDay(athleteId, planId, weekNumber, dayNumber);

  if (existing) {
    const updateData: Partial<FirestoreRpeReport> = {
      rpe: data.rpe,
      painLevel: data.pain_level ?? null,
      painLocation: data.pain_location ?? null,
      notes: data.notes ?? null,
      updatedAt: now,
    };

    await getDb()
      .collection(ATHLETES)
      .doc(athleteId)
      .collection(RPE_COLLECTION)
      .doc(existing.id)
      .update(updateData);

    return {
      ...existing,
      rpe: data.rpe,
      pain_level: data.pain_level ?? null,
      pain_location: data.pain_location ?? null,
      notes: data.notes ?? null,
      updated_at: now,
    };
  } else {
    const doc: FirestoreRpeReport = {
      athleteId,
      planId,
      weekNumber,
      dayNumber,
      rpe: data.rpe,
      painLevel: data.pain_level ?? null,
      painLocation: data.pain_location ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await getDb()
      .collection(ATHLETES)
      .doc(athleteId)
      .collection(RPE_COLLECTION)
      .add(doc);

    return toResponse(docRef.id, doc);
  }
}
