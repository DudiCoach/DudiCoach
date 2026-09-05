import type { Tables } from "@/lib/supabase/database.types";
import type { SessionOutcome } from "@/lib/validation/plan-session-feedback";

type PlanSessionFeedbackTableRow = Tables<"plan_session_feedback">;

export type PlanSessionFeedbackRow = Pick<
  PlanSessionFeedbackTableRow,
  | "id"
  | "plan_id"
  | "athlete_id"
  | "week_number"
  | "day_number"
  | "feedback_text"
  | "session_date"
  | "session_status"
  | "session_rpe"
  | "wellbeing"
  | "pain_score"
  | "pain_location"
  | "pain_side"
  | "created_at"
  | "updated_at"
>;

export type PublicPlanSessionFeedbackRow = Omit<
  PlanSessionFeedbackRow,
  "athlete_id"
>;

export type PlanSessionOutcomeInput = SessionOutcome;

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

export class PlanFeedbackRateLimitError extends Error {
  constructor(readonly retryAfter: string | null) {
    super("Plan feedback rate limit exceeded");
    this.name = "PlanFeedbackRateLimitError";
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

interface FetchPublicDayFeedbackParams extends PublicDayFeedbackParams {
  contractVersion?: 2;
}

interface UpsertPublicDayFeedbackLegacyParams extends PublicDayFeedbackParams {
  feedbackText: string;
}

interface UpsertPublicDayFeedbackV2Params extends PublicDayFeedbackParams {
  contractVersion: 2;
  feedbackText?: string | null;
  outcome: PlanSessionOutcomeInput;
}

type UpsertPublicDayFeedbackParams =
  | UpsertPublicDayFeedbackLegacyParams
  | UpsertPublicDayFeedbackV2Params;

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

function mapResponseToError(response: Response): Error {
  const { status } = response;
  if (status === 400) return new PlanFeedbackValidationError();
  if (status === 401) return new PlanFeedbackUnauthorizedError();
  if (status === 404) return new PlanFeedbackNotFoundError();
  if (status === 429) {
    return new PlanFeedbackRateLimitError(response.headers.get("Retry-After"));
  }
  return new PlanFeedbackRequestError();
}

export async function fetchPublicDayFeedback(
  params: FetchPublicDayFeedbackParams,
): Promise<PublicPlanSessionFeedbackRow | null> {
  const { shareCode, planId, weekNumber, dayNumber, contractVersion } = params;
  const searchParams = new URLSearchParams({
    weekNumber: String(weekNumber),
    dayNumber: String(dayNumber),
  });
  if (contractVersion === 2) {
    searchParams.set("contractVersion", "2");
  }

  const response = await fetch(
    `${publicFeedbackBaseUrl(shareCode, planId)}?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw mapResponseToError(response);
  }

  const json = await parseJson<{ data?: PublicPlanSessionFeedbackRow | null }>(
    response,
  );
  return json?.data ?? null;
}

export async function upsertPublicDayFeedback(
  params: UpsertPublicDayFeedbackParams,
): Promise<PublicPlanSessionFeedbackRow> {
  const { shareCode, planId, weekNumber, dayNumber } = params;
  const body =
    "contractVersion" in params && params.contractVersion === 2
      ? {
          contractVersion: 2,
          weekNumber,
          dayNumber,
          feedbackText: params.feedbackText ?? null,
          outcome: params.outcome,
        }
      : {
          weekNumber,
          dayNumber,
          feedbackText: params.feedbackText,
        };

  const response = await fetch(publicFeedbackBaseUrl(shareCode, planId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw mapResponseToError(response);
  }

  const json = await parseJson<{ data?: PublicPlanSessionFeedbackRow | null }>(
    response,
  );
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
    throw mapResponseToError(response);
  }

  const json = await parseJson<{ data?: PlanSessionFeedbackRow[] | null }>(
    response,
  );
  return json?.data ?? [];
}
