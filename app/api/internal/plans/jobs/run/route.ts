import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import {
  generatePlan,
} from "@/lib/ai/client";
import { parsePlanJson } from "@/lib/ai/parse-plan-json";
import {
  buildSystemPrompt,
  buildUserPrompt,
  computeAthleteLevel,
  computeTrainingMonths,
  type AthleteWithContext,
} from "@/lib/ai/prompts/plan-generation";
import { classifyPlanError } from "@/lib/ai/error-classification";
import {
  claimPendingJob,
  completePlanJob,
  failPlanJob,
} from "@/lib/data/plan-job";
import { getAthleteById, getDb } from "@/lib/firebase/admin";
import { createTrainingPlan } from "@/lib/data/training-plan";

// Worker route needs longer timeout
export const maxDuration = 120;

/**
 * POST /api/internal/plans/jobs/run
 * Worker endpoint that processes pending plan generation jobs.
 * Requires Bearer token authentication via PLAN_JOBS_WORKER_SECRET.
 *
 * Flow: authenticate → claim job → fetch athlete → build prompts →
 *   call AI → parse JSON → save plan → complete job
 */
export async function POST(request: NextRequest) {
  // --- Authenticate with shared secret ---
  const authHeader = request.headers.get("authorization");
  const workerSecret = process.env.PLAN_JOBS_WORKER_SECRET;

  if (!workerSecret || !authHeader?.startsWith("Bearer ")) {
    return new NextResponse(null, { status: 401 });
  }

  const token = authHeader.slice(7);
  const isValid =
    token.length === workerSecret.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(workerSecret));

  if (!isValid) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    // --- Claim a pending job ---
    const job = await claimPendingJob();
    if (!job) {
      return NextResponse.json({ message: "No pending jobs" }, { status: 200 });
    }

    console.log(`[Worker] Claimed job ${job.id} for athlete ${job.athlete_id}`);

    // --- Fetch athlete ---
    const athlete = await getAthleteById(job.athlete_id);
    if (!athlete) {
      await failPlanJob(
        job.id,
        "athlete_not_found",
        "Athlete not found",
        false,
      );
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // --- Build prompts ---
    const trainingMonths = computeTrainingMonths(athlete.data.trainingStartDate ?? null);
    const level = computeAthleteLevel(trainingMonths);

    // Fetch injuries
    const injuriesSnapshot = await getDb()
      .collection("athletes")
      .doc(job.athlete_id)
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
      id: job.athlete_id,
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

    // --- Call AI ---
    let rawText: string;
    try {
      rawText = await generatePlan({ systemPrompt, userPrompt });
    } catch (error) {
      const { errorCode, errorMessage, requeue } = classifyPlanError(error);
      console.error(`[Worker] AI error for job ${job.id}:`, errorCode, errorMessage);
      await failPlanJob(job.id, errorCode, errorMessage, requeue);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // --- Parse and validate JSON ---
    let planJson;
    try {
      planJson = parsePlanJson(rawText);
    } catch (error) {
      const { errorCode, errorMessage } = classifyPlanError(error);
      console.error(`[Worker] Parse error for job ${job.id}:`, errorCode);
      await failPlanJob(job.id, errorCode, errorMessage, false);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // --- Save plan ---
    try {
      const plan = await createTrainingPlan(job.athlete_id, {
        plan_name: planJson.planName,
        phase: planJson.phase,
        plan_json: planJson,
      });

      await completePlanJob(job.id, plan.id);

      console.log(`[Worker] Completed job ${job.id}, plan ${plan.id}`);
      return NextResponse.json({ success: true, planId: plan.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Worker] Failed to save plan for job ${job.id}:`, message);
      await failPlanJob(job.id, "save_error", "Failed to save plan", false);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Worker] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
