import { getDb } from "@/lib/firebase/admin";

// =============================================================================
// TYPES
// =============================================================================

export type PlanJobStatus = "pending" | "processing" | "succeeded" | "failed";

export interface PlanGenerationJob {
  id: string;
  athlete_id: string;
  coach_id: string;
  status: PlanJobStatus;
  plan_id: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  claim_token: string | null;
  claimed_at: string | null;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FirestorePlanJob {
  athleteId: string;
  coachId: string;
  status: PlanJobStatus;
  planId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  claimToken: string | null;
  claimedAt: string | null;
  processingStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, doc: FirestorePlanJob): PlanGenerationJob {
  return {
    id,
    athlete_id: doc.athleteId,
    coach_id: doc.coachId,
    status: doc.status,
    plan_id: doc.planId,
    error_code: doc.errorCode,
    error_message: doc.errorMessage,
    attempt_count: doc.attemptCount,
    max_attempts: doc.maxAttempts,
    claim_token: doc.claimToken,
    claimed_at: doc.claimedAt,
    processing_started_at: doc.processingStartedAt,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const JOBS_COLLECTION = "plan_generation_jobs";
const STALE_CLAIM_TIMEOUT_MS = 180_000; // 3 minutes
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_JOBS = 3;

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Create a new plan generation job.
 */
export async function createPlanJob(
  athleteId: string,
  coachId: string,
): Promise<PlanGenerationJob> {
  const now = new Date().toISOString();

  const doc: FirestorePlanJob = {
    athleteId,
    coachId,
    status: "pending",
    planId: null,
    errorCode: null,
    errorMessage: null,
    attemptCount: 0,
    maxAttempts: 3,
    claimToken: null,
    claimedAt: null,
    processingStartedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await getDb().collection(JOBS_COLLECTION).add(doc);
  return toResponse(docRef.id, doc);
}

/**
 * Get a job by ID.
 */
export async function getPlanJob(jobId: string): Promise<PlanGenerationJob | null> {
  const doc = await getDb().collection(JOBS_COLLECTION).doc(jobId).get();
  if (!doc.exists) return null;
  return toResponse(doc.id, doc.data() as FirestorePlanJob);
}

/**
 * Get jobs for a coach (filtered by coach_id).
 */
export async function getPlanJobsByCoach(coachId: string): Promise<PlanGenerationJob[]> {
  const snapshot = await getDb()
    .collection(JOBS_COLLECTION)
    .where("coachId", "==", coachId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestorePlanJob));
}

/**
 * Get jobs for an athlete.
 */
export async function getPlanJobsByAthlete(athleteId: string): Promise<PlanGenerationJob[]> {
  const snapshot = await getDb()
    .collection(JOBS_COLLECTION)
    .where("athleteId", "==", athleteId)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestorePlanJob));
}

/**
 * Check rate limit: max 3 jobs per coach per minute.
 */
export async function checkJobRateLimit(coachId: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const oneMinuteAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const snapshot = await getDb()
    .collection(JOBS_COLLECTION)
    .where("coachId", "==", coachId)
    .where("createdAt", ">=", oneMinuteAgo)
    .get();

  if (snapshot.size >= RATE_LIMIT_MAX_JOBS) {
    // Find the oldest job in the window to calculate retry-after
    const oldest = snapshot.docs.reduce((oldest, doc) => {
      const data = doc.data() as FirestorePlanJob;
      return data.createdAt < oldest ? data.createdAt : oldest;
    }, snapshot.docs[0].data().createdAt as string);

    const retryAfterMs = new Date(oldest).getTime() + RATE_LIMIT_WINDOW_MS - Date.now();
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  return { allowed: true };
}

/**
 * Claim a pending job for processing.
 * Uses a claim token to prevent race conditions.
 */
export async function claimPendingJob(): Promise<PlanGenerationJob | null> {
  const now = new Date().toISOString();
  const claimToken = crypto.randomUUID();

  // Find pending jobs
  const snapshot = await getDb()
    .collection(JOBS_COLLECTION)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const job = doc.data() as FirestorePlanJob;

  // Check for stale claims (jobs stuck in processing)
  if (job.status === "processing" && job.processingStartedAt) {
    const startedAt = new Date(job.processingStartedAt).getTime();
    if (Date.now() - startedAt > STALE_CLAIM_TIMEOUT_MS) {
      // Reset the stale job
      await doc.ref.update({
        status: "pending",
        claimToken: null,
        claimedAt: null,
        processingStartedAt: null,
        updatedAt: now,
      });
    }
  }

  // Try to claim the job
  await doc.ref.update({
    status: "processing",
    claimToken,
    claimedAt: now,
    processingStartedAt: now,
    attemptCount: job.attemptCount + 1,
    updatedAt: now,
  });

  return toResponse(doc.id, {
    ...job,
    status: "processing",
    claimToken,
    claimedAt: now,
    processingStartedAt: now,
    attemptCount: job.attemptCount + 1,
  });
}

/**
 * Complete a job successfully.
 */
export async function completePlanJob(
  jobId: string,
  planId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await getDb().collection(JOBS_COLLECTION).doc(jobId).update({
    status: "succeeded",
    planId,
    updatedAt: now,
  });
}

/**
 * Fail a job.
 * If requeue is true and attempts < max, reset to pending for retry.
 */
export async function failPlanJob(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  requeue: boolean = false,
): Promise<void> {
  const now = new Date().toISOString();
  const doc = await getDb().collection(JOBS_COLLECTION).doc(jobId).get();

  if (!doc.exists) return;

  const job = doc.data() as FirestorePlanJob;

  if (requeue && job.attemptCount < job.maxAttempts) {
    // Reset to pending for retry
    await doc.ref.update({
      status: "pending",
      claimToken: null,
      claimedAt: null,
      processingStartedAt: null,
      errorCode,
      errorMessage,
      updatedAt: now,
    });
  } else {
    // Final failure
    await doc.ref.update({
      status: "failed",
      errorCode,
      errorMessage,
      updatedAt: now,
    });
  }
}

/**
 * Delete old jobs (cleanup).
 */
export async function deleteOldJobs(olderThanDays: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const snapshot = await getDb()
    .collection(JOBS_COLLECTION)
    .where("createdAt", "<", cutoff)
    .where("status", "in", ["succeeded", "failed"])
    .limit(100)
    .get();

  const batch = getDb().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return snapshot.size;
}
