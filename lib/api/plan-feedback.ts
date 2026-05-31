import type { Tables } from "@/lib/supabase/database.types";

export type PlanSessionFeedbackRow = Tables<"plan_session_feedback">;

export class PlanFeedbackValidationError extends Error {
  constructor() {
    super("Plan feedback validation failed");
    this.name = "PlanFeedbackValidationError";
  }
}

export class PlanFeedbackNotFoundError extends Error {
  constructor() {
    super("Plan feedback resource not found");
    this.name = "PlanFeedbackNotFoundError";
  }
}

export class PlanFeedbackUnauthorizedError extends Error {
  constructor() {
    super("Plan feedback request unauthorized");
    this.name = "PlanFeedbackUnauthorizedError";
  }
}

export class PlanFeedbackRequestError extends Error {
  constructor() {
    super("Plan feedback request failed");
    this.name = "PlanFeedbackRequestError";
  }
}

export const planFeedbackKeys = {
  all: ["plan-feedback"] as const,
  coachPlan: (athleteId: string, planId: string) =>
    [...planFeedbackKeys.all, "coach", athleteId, planId] as const,
};

interface PublicDayFeedbackParams {
  shareCode: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
}

interface UpsertPublicDayFeedbackParams extends PublicDayFeedbackParams {
  feedbackText: string;
}

interface CoachPlanFeedbackParams {
  athleteId: string;
  planId: string;
}

function publicFeedbackBaseUrl(shareCode: string, planId: string) {
  const encodedShareCode = encodeURIComponent(shareCode);
  const encodedPlanId = encodeURIComponent(planId);
  return `/api/athlete/${encodedShareCode}/plans/${encodedPlanId}/feedback`;
}

function coachFeedbackUrl(athleteId: string, planId: string) {
  const encodedAthleteId = encodeURIComponent(athleteId);
  const encodedPlanId = encodeURIComponent(planId);
  return `/api/athletes/${encodedAthleteId}/plans/${encodedPlanId}/feedback`;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mapStatusToError(status: number): Error {
  if (status === 400) return new PlanFeedbackValidationError();
  if (status === 401) return new PlanFeedbackUnauthorizedError();
  if (status === 404) return new PlanFeedbackNotFoundError();
  return new PlanFeedbackRequestError();
}

export async function fetchPublicDayFeedback({
  shareCode,
  planId,
  weekNumber,
  dayNumber,
}: PublicDayFeedbackParams): Promise<PlanSessionFeedbackRow | null> {
  const searchParams = new URLSearchParams({
    weekNumber: String(weekNumber),
    dayNumber: String(dayNumber),
  });

  const response = await fetch(
    `${publicFeedbackBaseUrl(shareCode, planId)}?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw mapStatusToError(response.status);
  }

  const json = await parseJson<{ data?: PlanSessionFeedbackRow | null }>(response);
  return json?.data ?? null;
}

export async function upsertPublicDayFeedback({
  shareCode,
  planId,
  weekNumber,
  dayNumber,
  feedbackText,
}: UpsertPublicDayFeedbackParams): Promise<PlanSessionFeedbackRow> {
  const response = await fetch(publicFeedbackBaseUrl(shareCode, planId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weekNumber,
      dayNumber,
      feedbackText,
    }),
  });

  if (!response.ok) {
    throw mapStatusToError(response.status);
  }

  const json = await parseJson<{ data?: PlanSessionFeedbackRow | null }>(response);
  if (!json?.data) {
    throw new PlanFeedbackRequestError();
  }

  return json.data;
}

export async function fetchCoachPlanFeedback({
  athleteId,
  planId,
}: CoachPlanFeedbackParams): Promise<PlanSessionFeedbackRow[]> {
  const response = await fetch(coachFeedbackUrl(athleteId, planId));

  if (!response.ok) {
    throw mapStatusToError(response.status);
  }

  const json = await parseJson<{ data?: PlanSessionFeedbackRow[] | null }>(response);
  return json?.data ?? [];
}
