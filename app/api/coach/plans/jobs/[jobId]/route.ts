import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getPlanJob } from "@/lib/data/plan-job";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/coach/plans/jobs/[jobId]
 * Get the status of a plan generation job.
 * Used for polling by the frontend.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;

  // session cookie auth
  const { user, response } = await requireAuth(
    "GET /api/coach/plans/jobs/[jobId]",
  );
  if (response) return response;

  try {
    // Get the job
    const job = await getPlanJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify the job belongs to this coach
    if (job.coach_id !== user.uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (error) {
    console.error("[GET /api/coach/plans/jobs/[jobId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
