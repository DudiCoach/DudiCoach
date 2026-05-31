import {
  getTrainingPlans as fbGetPlans,
  getAthleteByShareCode as fbGetByShareCode,
} from "@/lib/firebase/admin";
import { getDb } from "@/lib/firebase/admin";

// =============================================================================
// TYPES
// =============================================================================

export interface SessionFeedback {
  id: string;
  athlete_id: string;
  plan_id: string;
  week_number: number;
  day_number: number;
  feedback_text: string;
  created_at: string;
  updated_at: string;
}

interface FirestoreSessionFeedback {
  athleteId: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
  feedbackText: string;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, doc: FirestoreSessionFeedback): SessionFeedback {
  return {
    id,
    athlete_id: doc.athleteId,
    plan_id: doc.planId,
    week_number: doc.weekNumber,
    day_number: doc.dayNumber,
    feedback_text: doc.feedbackText,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ATHLETES = "athletes";
const FEEDBACK_COLLECTION = "session_feedback";

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Sanitize feedback text: trim, reject all-whitespace, remove control chars.
 */
export function sanitizeFeedbackText(text: string): string {
  // Trim whitespace
  let sanitized = text.trim();

  // Reject all-whitespace
  if (sanitized.length === 0) {
    throw new Error("Feedback text cannot be empty or whitespace only");
  }

  // Remove control chars except \n and \t
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Validate that week/day numbers exist in the plan.
 */
export function validatePlanDay(
  planJson: { weeks: Array<{ weekNumber: number; days: Array<{ dayNumber: number }> }> },
  weekNumber: number,
  dayNumber: number,
): boolean {
  const week = planJson.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) return false;
  return week.days.some((d) => d.dayNumber === dayNumber);
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all feedback for an athlete's plan.
 */
export async function getSessionFeedbackByPlan(
  athleteId: string,
  planId: string,
): Promise<SessionFeedback[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(FEEDBACK_COLLECTION)
    .where("planId", "==", planId)
    .orderBy("weekNumber", "asc")
    .orderBy("dayNumber", "asc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreSessionFeedback));
}

/**
 * Get feedback for a specific day in a plan.
 */
export async function getSessionFeedbackByDay(
  athleteId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
): Promise<SessionFeedback | null> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(FEEDBACK_COLLECTION)
    .where("planId", "==", planId)
    .where("weekNumber", "==", weekNumber)
    .where("dayNumber", "==", dayNumber)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return toResponse(doc.id, doc.data() as FirestoreSessionFeedback);
}

/**
 * Get feedback for a plan by share code (public endpoint).
 */
export async function getSessionFeedbackByShareCode(
  shareCode: string,
  planId: string,
): Promise<SessionFeedback[]> {
  // First, get the athlete by share code
  const athlete = await fbGetByShareCode(shareCode);
  if (!athlete) return [];

  // Verify the plan belongs to this athlete
  const plans = await fbGetPlans(athlete.id);
  const planExists = plans.some((p) => p.id === planId);
  if (!planExists) return [];

  return getSessionFeedbackByPlan(athlete.id, planId);
}

/**
 * Upsert (create or update) feedback for a specific day.
 */
export async function upsertSessionFeedback(
  athleteId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
  feedbackText: string,
): Promise<SessionFeedback> {
  const sanitizedText = sanitizeFeedbackText(feedbackText);
  const now = new Date().toISOString();

  // Check if feedback already exists for this day
  const existing = await getSessionFeedbackByDay(athleteId, planId, weekNumber, dayNumber);

  if (existing) {
    // Update existing feedback
    const updateData: Partial<FirestoreSessionFeedback> = {
      feedbackText: sanitizedText,
      updatedAt: now,
    };

    await getDb()
      .collection(ATHLETES)
      .doc(athleteId)
      .collection(FEEDBACK_COLLECTION)
      .doc(existing.id)
      .update(updateData);

    return {
      ...existing,
      feedback_text: sanitizedText,
      updated_at: now,
    };
  } else {
    // Create new feedback
    const doc: FirestoreSessionFeedback = {
      athleteId,
      planId,
      weekNumber,
      dayNumber,
      feedbackText: sanitizedText,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await getDb()
      .collection(ATHLETES)
      .doc(athleteId)
      .collection(FEEDBACK_COLLECTION)
      .add(doc);

    return toResponse(docRef.id, doc);
  }
}

/**
 * Delete feedback for a specific day.
 */
export async function deleteSessionFeedback(
  athleteId: string,
  feedbackId: string,
): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection(FEEDBACK_COLLECTION)
    .doc(feedbackId)
    .delete();
}
