import {
  getTrainingPlans as fbGetPlans,
  createTrainingPlan as fbCreatePlan,
  getAthleteByShareCode as fbGetByShareCode,
} from "@/lib/firebase/admin";
import type { FirestoreTrainingPlan } from "@/lib/firebase/admin";
import type { TrainingPlanJson } from "@/lib/validation/training-plan";

export interface TrainingPlan {
  id: string;
  athlete_id: string;
  plan_name: string;
  phase: string | null;
  plan_json: TrainingPlanJson;
  is_active: boolean;
  created_at: string;
}

export interface PublicTrainingPlan {
  id: string;
  plan_name: string;
  phase: string | null;
  plan_json: TrainingPlanJson;
  created_at: string;
}

function toResponse(id: string, athleteId: string, doc: FirestoreTrainingPlan): TrainingPlan {
  return {
    id,
    athlete_id: athleteId,
    plan_name: doc.planName,
    phase: doc.phase ?? null,
    plan_json: doc.planJson as TrainingPlanJson,
    is_active: doc.isActive ?? true,
    created_at: doc.createdAt,
  };
}

function toPublic(doc: FirestoreTrainingPlan, id: string): PublicTrainingPlan {
  return {
    id,
    plan_name: doc.planName,
    phase: doc.phase ?? null,
    plan_json: doc.planJson as TrainingPlanJson,
    created_at: doc.createdAt,
  };
}

/**
 * Get all training plans for an athlete, ordered by creation date (newest first).
 */
export async function getTrainingPlans(athleteId: string): Promise<TrainingPlan[]> {
  const results = await fbGetPlans(athleteId);
  return results.map(({ id, data }) => toResponse(id, athleteId, data));
}

/**
 * Get the latest active training plan for an athlete by share code.
 * Returns null if no athlete found or no active plans exist.
 */
export async function getLatestPlanByShareCode(
  shareCode: string,
): Promise<PublicTrainingPlan | null> {
  const athlete = await fbGetByShareCode(shareCode);
  if (!athlete) return null;

  const plans = await fbGetPlans(athlete.id);
  if (plans.length === 0) return null;

  // Find the latest active plan
  const activePlan = plans.find((p) => p.data.isActive);
  if (!activePlan) return null;

  return toPublic(activePlan.data, activePlan.id);
}

/**
 * Archive a training plan (set is_active to false).
 */
export async function archiveTrainingPlan(
  athleteId: string,
  planId: string,
): Promise<void> {
  const { updateTrainingPlan: fbUpdate } = await import("@/lib/firebase/admin");
  await fbUpdate(athleteId, planId, { isActive: false });
}

/**
 * Activate a training plan (set is_active to true).
 * Also deactivates all other plans for the athlete.
 */
export async function activateTrainingPlan(
  athleteId: string,
  planId: string,
): Promise<void> {
  const { updateTrainingPlan: fbUpdate, getDb } = await import("@/lib/firebase/admin");
  const db = getDb();

  // Deactivate all plans for this athlete
  const plans = await fbGetPlans(athleteId);
  const batch = db.batch();
  for (const plan of plans) {
    if (plan.data.isActive) {
      const docRef = db.collection("athletes").doc(athleteId).collection("training_plans").doc(plan.id);
      batch.update(docRef, { isActive: false });
    }
  }
  await batch.commit();

  // Activate the selected plan
  await fbUpdate(athleteId, planId, { isActive: true });
}

/**
 * Create a new training plan for an athlete.
 */
export async function createTrainingPlan(
  athleteId: string,
  input: {
    plan_name: string;
    phase?: string | null;
    plan_json: Record<string, unknown>;
    is_active?: boolean;
  },
): Promise<TrainingPlan> {
  const now = new Date().toISOString();
  const doc: FirestoreTrainingPlan = {
    planName: input.plan_name,
    phase: input.phase ?? null,
    planJson: input.plan_json,
    isActive: input.is_active ?? true,
    createdAt: now,
  };

  const { id, data } = await fbCreatePlan(athleteId, doc);
  return toResponse(id, athleteId, data);
}

/**
 * Duplicate an existing training plan for an athlete.
 * Creates a copy with a new name and deactivates the original.
 */
export async function duplicateTrainingPlan(
  athleteId: string,
  sourcePlanId: string,
  newName: string,
): Promise<TrainingPlan> {
  const plans = await fbGetPlans(athleteId);
  const sourcePlan = plans.find((p) => p.id === sourcePlanId);
  if (!sourcePlan) {
    throw new Error("Source plan not found");
  }

  const newPlan = await createTrainingPlan(athleteId, {
    plan_name: newName,
    phase: sourcePlan.data.phase,
    plan_json: sourcePlan.data.planJson,
    is_active: true,
  });

  // Archive the original plan
  await archiveTrainingPlan(athleteId, sourcePlanId);

  return newPlan;
}
