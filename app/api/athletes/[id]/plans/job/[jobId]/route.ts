import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getPlanJob } from "@/lib/data/plan-job";
import { getAthleteById } from "@/lib/firebase/admin";

type RouteContext = { params: Promise<{ id: string; jobId: string }> };

/**
 * GET /api/athletes/[id]/plans/job/[jobId]
 * Get the status of a plan generation job.
 * Used for polling by the frontend.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id: athleteId, jobId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "GET /api/athletes/[id]/plans/job/[jobId]",
  );
  if (response) return response;

  try {
    // Fetch athlete to verify ownership
    const athlete = await getAthleteById(athleteId);
    if (!athlete || athlete.data.coachId !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get the job
    const job = await getPlanJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify the job belongs to this athlete
    if (job.athlete_id !== athleteId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (error) {
    console.error("[GET /api/athletes/[id]/plans/job/[jobId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
