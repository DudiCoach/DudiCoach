import { NextRequest, NextResponse } from "next/server";

import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getLatestPlanByShareCode } from "@/lib/data/training-plan";
import { validatePlanDay } from "@/lib/data/session-feedback";
import { publicRpeReportSchema } from "@/lib/validation/rpe-report";
import { upsertRpeReport as upsertRpe } from "@/lib/data/rpe-report";
import { getRpeReportsByShareCode as getRpeByShareCode } from "@/lib/data/rpe-report";

type RouteContext = { params: Promise<{ shareCode: string }> };

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * GET /api/athlete/[shareCode]/rpe
 * Public endpoint. Returns all RPE reports for a plan.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("plan_id");

    if (!planId) {
      return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
    }

    const athlete = await getAthleteByShareCode(normalized);
    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const reports = await getRpeByShareCode(normalized, planId);

    return NextResponse.json({ data: reports });
  } catch (error) {
    console.error("[GET /api/athlete/[shareCode]/rpe] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/athlete/[shareCode]/rpe
 * Public endpoint. Creates or updates an RPE report for a specific day.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const athlete = await getAthleteByShareCode(normalized);
    if (!athlete || !athlete.share_active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = publicRpeReportSchema.safeParse({
      ...body,
      share_code: normalized,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { plan_id, week_number, day_number, rpe, pain_level, pain_location, notes } = parsed.data;

    // Validate plan and day
    const plan = await getLatestPlanByShareCode(normalized);
    if (!plan || plan.id !== plan_id) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!validatePlanDay(plan.plan_json, week_number, day_number)) {
      return NextResponse.json(
        { error: "Invalid week or day number for this plan" },
        { status: 400 },
      );
    }

    const report = await upsertRpe(athlete.id, plan_id, week_number, day_number, {
      rpe,
      pain_level,
      pain_location,
      notes,
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athlete/[shareCode]/rpe] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
