import { getDb } from "@/lib/firebase/admin";

// =============================================================================
// TYPES
// =============================================================================

export interface CycleSummary {
  id: string;
  athlete_id: string;
  plan_id: string;
  cycle_number: number;
  title: string;
  notes: string;
  results: CycleResult[];
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CycleResult {
  metric: string;
  before: string;
  after: string;
  improvement?: string;
}

interface FirestoreCycleSummary {
  athleteId: string;
  planId: string;
  cycleNumber: number;
  title: string;
  notes: string;
  results: CycleResult[];
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, doc: FirestoreCycleSummary): CycleSummary {
  return {
    id,
    athlete_id: doc.athleteId,
    plan_id: doc.planId,
    cycle_number: doc.cycleNumber,
    title: doc.title,
    notes: doc.notes,
    results: doc.results,
    completed_at: doc.completedAt,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ATHLETES = "athletes";
const SUMMARIES_COLLECTION = "cycle_summaries";

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all cycle summaries for an athlete.
 */
export async function getCycleSummaries(athleteId: string): Promise<CycleSummary[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .orderBy("cycleNumber", "desc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreCycleSummary));
}

/**
 * Get a cycle summary by ID.
 */
export async function getCycleSummaryById(
  athleteId: string,
  summaryId: string,
): Promise<CycleSummary | null> {
  const doc = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .doc(summaryId)
    .get();

  if (!doc.exists) return null;
  return toResponse(doc.id, doc.data() as FirestoreCycleSummary);
}

/**
 * Get cycle summaries for a specific plan.
 */
export async function getCycleSummariesByPlan(
  athleteId: string,
  planId: string,
): Promise<CycleSummary[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .where("planId", "==", planId)
    .orderBy("cycleNumber", "desc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreCycleSummary));
}

/**
 * Create a new cycle summary.
 */
export async function createCycleSummary(
  athleteId: string,
  input: {
    plan_id: string;
    cycle_number: number;
    title: string;
    notes?: string;
    results?: CycleResult[];
  },
): Promise<CycleSummary> {
  const now = new Date().toISOString();
  const doc: FirestoreCycleSummary = {
    athleteId,
    planId: input.plan_id,
    cycleNumber: input.cycle_number,
    title: input.title,
    notes: input.notes ?? "",
    results: input.results ?? [],
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .add(doc);

  return toResponse(docRef.id, doc);
}

/**
 * Update a cycle summary.
 */
export async function updateCycleSummary(
  athleteId: string,
  summaryId: string,
  input: Partial<{
    title: string;
    notes: string;
    results: CycleResult[];
  }>,
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.results !== undefined) updateData.results = input.results;
  updateData.updatedAt = new Date().toISOString();

  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .doc(summaryId)
    .update(updateData);
}

/**
 * Delete a cycle summary.
 */
export async function deleteCycleSummary(
  athleteId: string,
  summaryId: string,
): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(SUMMARIES_COLLECTION)
    .doc(summaryId)
    .delete();
}
