import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import {
  ANTHROPIC_TIMEOUT_MS,
  generatePlan,
  MODEL,
  PLAN_MAX_TOKENS,
} from "@/lib/ai/client";
import { parsePlanJson } from "@/lib/ai/parse-plan-json";
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeAthleteLevel,
  computeTrainingMonths,
  type AthleteWithContext,
} from "@/lib/ai/prompts/plan-generation";
import { checkRateLimit } from "@/lib/ai/rate-limiter";

import { createTrainingPlan, getTrainingPlans } from "@/lib/data/training-plan";
import { getAthleteById, getDb } from "@/lib/firebase/admin";

// Next.js 16: params is a Promise — must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

// Keep enough runtime budget for long first-plan generations.
export const maxDuration = 180;

// Feature flag: "sync" (default) or "async"
const PLAN_GENERATION_MODE = process.env.NEXT_PUBLIC_PLAN_GENERATION_MODE ?? "sync";

// ---------------------------------------------------------------------------
// Retry configuration (for sync mode)
//
// Retry exactly once on transient errors (500/502/503/529 or fetch failures).
// Parse/validation errors are deterministic and NOT retried.
// See: docs/design/US-005-design.md §6
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 529]);
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return RETRYABLE_STATUS_CODES.has(error.status ?? 0);
  }
  // Network errors (fetch failures) — retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch") || msg.includes("network")) {
      return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/athletes/[id]/plans
 * Generate a new AI training plan for the given athlete.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const { user, response } = await requireAuth("POST /api/athletes/[id]/plans");
  if (response) return response;

  // --- Async mode: delegate to job queue ---
  if (PLAN_GENERATION_MODE === "async") {
    try {
      const athlete = await getAthleteById(id);
      if (!athlete) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (athlete.data.coachId !== user.uid) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (!athlete.data.sport || !athlete.data.trainingDaysPerWeek) {
        return NextResponse.json(
          { error: "Uzupełnij dane zawodnika (sport, dni treningowe) przed generowaniem." },
          { status: 422 },
        );
      }

      const { createPlanJob, checkJobRateLimit, getPlanJobsByAthlete } = await import("@/lib/data/plan-job");

      const rl = await checkJobRateLimit(user.uid);
      if (!rl.allowed) {
        const retryAfterSec = Math.max(1, Math.ceil((rl.retryAfterMs ?? 0) / 1000));
        return NextResponse.json(
          { error: "Zbyt wiele prób. Poczekaj chwilę." },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
        );
      }

      const existingJobs = await getPlanJobsByAthlete(id);
      const activeJob = existingJobs.find((j) => j.status === "pending" || j.status === "processing");
      if (activeJob) {
        return NextResponse.json({ error: "Generowanie planu jest już w toku." }, { status: 409 });
      }

      const job = await createPlanJob(id, user.uid);
      return NextResponse.json({ data: job }, { status: 202 });
    } catch (error) {
      console.error("[POST /plans] Async mode error", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // --- Sync mode ---
  const rl = checkRateLimit(user.uid);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.retryAfterMs ?? 0) / 1000));
    return NextResponse.json(
      { error: "Zbyt wiele prób. Poczekaj chwilę." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const athlete = await getAthleteById(id);
  if (!athlete || athlete.data.coachId !== user.uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!athlete.data.sport || !athlete.data.trainingDaysPerWeek) {
    return NextResponse.json(
      { error: "Uzupełnij dane zawodnika (sport, dni treningowe) przed generowaniem." },
      { status: 422 },
    );
  }

  const trainingMonths = computeTrainingMonths(athlete.data.trainingStartDate ?? null);
  const level = computeAthleteLevel(trainingMonths);

  // Fetch injuries from Firestore
  const injuriesSnapshot = await getDb()
    .collection("athletes")
    .doc(id)
    .collection("injuries")
    .where("status", "in", ["active", "healing"])
    .get();

  const activeInjuries = injuriesSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      name: data.name ?? "",
      severity: String(data.severity ?? "0"),
      notes: data.notes ?? null,
    };
  });

  const athleteWithContext: AthleteWithContext = {
    id,
    coach_id: athlete.data.coachId,
    name: athlete.data.name ?? "",
    age: athlete.data.age ?? null,
    weight_kg: athlete.data.weightKg ?? null,
    height_cm: athlete.data.heightCm ?? null,
    sport: athlete.data.sport ?? null,
    training_start_date: athlete.data.trainingStartDate ?? null,
    training_days_per_week: athlete.data.trainingDaysPerWeek ?? null,
    session_minutes: athlete.data.sessionMinutes ?? null,
    current_phase: athlete.data.currentPhase ?? null,
    goal: athlete.data.goal ?? null,
    notes: athlete.data.notes ?? null,
    share_code: athlete.data.shareCode,
    share_active: athlete.data.shareActive,
    created_at: athlete.data.createdAt,
    updated_at: athlete.data.updatedAt,
    trainingMonths,
    level,
    activeInjuries,
    diagnosticFindings: [],
    recentProgressions: [],
  };

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(athleteWithContext);

  // --- Call AI with retry loop ---
  let rawText: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      rawText = await generatePlan({ systemPrompt, userPrompt });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS && isRetryableError(err)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }

  if (rawText === null) {
    if (lastError instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("[POST /plans] Anthropic request timeout", {
        model: MODEL, maxTokens: PLAN_MAX_TOKENS, timeoutMs: ANTHROPIC_TIMEOUT_MS,
      });
      return NextResponse.json({ error: "Przekroczono czas. Spróbuj ponownie." }, { status: 504 });
    }
    if (lastError instanceof Anthropic.APIError) {
      console.error("[POST /plans] Anthropic API error", {
        status: lastError.status, message: lastError.message,
      });
      return NextResponse.json({ error: "Nie udało się wygenerować planu." }, { status: 500 });
    }
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.error("[POST /plans] Unexpected error during generation", { message });
    return NextResponse.json({ error: "Nie udało się wygenerować planu." }, { status: 500 });
  }

  let planJson;
  try {
    planJson = parsePlanJson(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /plans] Plan JSON parse/validation failed", { message });
    return NextResponse.json({ error: "Nie udało się wygenerować planu." }, { status: 500 });
  }

  try {
    const plan = await createTrainingPlan(id, {
      plan_name: planJson.planName,
      phase: planJson.phase,
      plan_json: planJson,
    });
    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /plans] Failed to persist plan", { message });
    return NextResponse.json({ error: "Nie udało się zapisać planu." }, { status: 500 });
  }
}

/**
 * GET /api/athletes/[id]/plans
 * List all plans for an athlete, most recent first.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const { response } = await requireAuth("GET /api/athletes/[id]/plans");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const plans = await getTrainingPlans(id);
    return NextResponse.json({ data: plans });
  } catch (error) {
    console.error("[GET /plans] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
