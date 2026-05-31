import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import {
  createPlanJob,
  checkJobRateLimit,
  getPlanJobsByAthlete,
} from "@/lib/data/plan-job";
import { getAthleteById } from "@/lib/firebase/admin";

/**
 * POST /api/coach/plans/jobs
 * Create a new async plan generation job.
 * Returns 202 with job details if accepted.
 */
export async function POST(request: NextRequest) {
  // session cookie auth
  const { user, response } = await requireAuth(
    "POST /api/coach/plans/jobs",
  );
  if (response) return response;

  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const athleteId = body.athleteId as string;
    if (!athleteId) {
      return NextResponse.json(
        { error: "athleteId is required" },
        { status: 400 },
      );
    }

    // Fetch athlete from Firestore
    const athlete = await getAthleteById(athleteId);
    if (!athlete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify coach ownership
    if (athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Minimum-data completeness check
    if (!athlete.data.sport || !athlete.data.trainingDaysPerWeek) {
      return NextResponse.json(
        {
          error:
            "Uzupełnij dane zawodnika (sport, dni treningowe) przed generowaniem.",
        },
        { status: 422 },
      );
    }

    // Check rate limit (3 jobs per minute per coach)
    const rl = await checkJobRateLimit(user.uid);
    if (!rl.allowed) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rl.retryAfterMs ?? 0) / 1000),
      );
      return NextResponse.json(
        { error: "Zbyt wiele prób. Poczekaj chwilę." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      );
    }

    // Check for existing pending/processing jobs for this athlete
    const existingJobs = await getPlanJobsByAthlete(athleteId);
    const activeJob = existingJobs.find(
      (j) => j.status === "pending" || j.status === "processing",
    );

    if (activeJob) {
      return NextResponse.json(
        { error: "Generowanie planu jest już w toku." },
        { status: 409 },
      );
    }

    // Create the job
    const job = await createPlanJob(athleteId, user.uid);

    return NextResponse.json({ data: job }, { status: 202 });
  } catch (error) {
    console.error("[POST /api/coach/plans/jobs] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
