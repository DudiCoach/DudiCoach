import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { getAthleteById } from "@/lib/data/athlete";
import {
  getFitnessTestResults,
  createFitnessTestResult,
} from "@/lib/data/fitness-test";
import {
  isFitnessTestKeyAllowedForSport,
} from "@/lib/constants/fitness-tests";
import { SPORTS, type Sport } from "@/lib/constants/sports";
import { createFitnessTestResultSchema } from "@/lib/validation/fitness-test";

type RouteContext = { params: Promise<{ id: string }> };

const ATHLETE_NOT_FOUND_ERROR = "Nie znaleziono zawodnika.";

function normalizeSport(value: string | null): Sport | null {
  if (value === null) return null;
  return (SPORTS as readonly string[]).includes(value)
    ? (value as Sport)
    : null;
}

/**
 * GET /api/athletes/[id]/tests
 * Returns all fitness test results for one athlete ordered by test_date DESC.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;

  const { response } = await requireAuth("GET /api/athletes/[id]/tests");
  if (response) return response;

  const athlete = await getAthleteById(id);
  if (!athlete) {
    return NextResponse.json({ error: ATHLETE_NOT_FOUND_ERROR }, { status: 404 });
  }

  const results = await getFitnessTestResults(id);

  // Map to API shape
  const data = results.map(({ id: testId, data: r }) => ({
    id: testId,
    athlete_id: r.athleteId,
    test_key: r.testKey,
    test_date: r.testDate,
    value: r.value,
    unit: r.unit,
    notes: r.notes,
    created_at: r.createdAt,
  }));

  return NextResponse.json({ data });
}

/**
 * POST /api/athletes/[id]/tests
 * Creates one fitness test result for an athlete owned by authenticated coach.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;

  const { response } = await requireAuth("POST /api/athletes/[id]/tests");
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createFitnessTestResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const athlete = await getAthleteById(id);
  if (!athlete) {
    return NextResponse.json({ error: ATHLETE_NOT_FOUND_ERROR }, { status: 404 });
  }

  const athleteSport = normalizeSport(athlete.sport ?? null);
  const isAllowed = isFitnessTestKeyAllowedForSport(
    parsed.data.test_key,
    athleteSport,
  );

  if (!isAllowed) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: [
          {
            path: ["test_key"],
            message: "Test is not allowed for athlete sport",
            code: "custom",
          },
        ],
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const result = await createFitnessTestResult({
    athleteId: id,
    testKey: parsed.data.test_key,
    testDate: parsed.data.test_date ?? now.split("T")[0],
    value: parsed.data.value,
    notes: parsed.data.notes ?? null,
    createdAt: now,
  });

  return NextResponse.json(
    {
      data: {
        id: result.id,
        athlete_id: id,
        test_key: result.data.testKey,
        test_date: result.data.testDate,
        value: result.data.value,
        unit: result.data.unit,
        notes: result.data.notes,
        created_at: result.data.createdAt,
      },
    },
    { status: 201 },
  );
}
