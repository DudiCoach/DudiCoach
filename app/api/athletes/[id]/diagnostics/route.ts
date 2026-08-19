import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { createDiagnosticSchema } from "@/lib/validation/diagnostic";

type RouteContext = { params: Promise<{ id: string }> };
type SupabaseErrorLike = { code?: string; message?: string } | null;

const NOT_FOUND_ERROR_CODE = "PGRST116";
const UNIQUE_VIOLATION_CODE = "23505";
const ATHLETE_NOT_FOUND_ERROR = "Nie znaleziono zawodnika.";
const CONFLICT_ERROR = "Znalezisko dla tego mięśnia i strony już istnieje.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function isNotFoundError(error: SupabaseErrorLike): boolean {
  return error?.code === NOT_FOUND_ERROR_CODE;
}

async function ensureAthleteExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  routeLabel: string,
  internalErrorMessage: string,
): Promise<NextResponse | null> {
  const { data: athlete, error } = await supabase
    .from("athletes")
    .select("id")
    .eq("id", athleteId)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return jsonError({ error: ATHLETE_NOT_FOUND_ERROR }, 404);
    }

    console.error(`[${routeLabel}] failed to verify athlete`, {
      code: error.code,
      message: error.message,
    });
    return jsonError({ error: internalErrorMessage }, 500);
  }

  if (!athlete) {
    return jsonError({ error: ATHLETE_NOT_FOUND_ERROR }, 404);
  }

  return null;
}

/**
 * GET /api/athletes/[id]/diagnostics
 * Returns FMS findings for one athlete, ordered by observed_at DESC.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "GET /api/athletes/[id]/diagnostics",
  );
  if (response) return response;

  const athleteCheck = await ensureAthleteExists(
    supabase,
    id,
    "GET /api/athletes/[id]/diagnostics",
    "Nie udało się pobrać znalezisk.",
  );
  if (athleteCheck) return athleteCheck;

  const { data, error } = await supabase
    .from("diagnostic_findings")
    .select("*")
    .eq("athlete_id", id)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/athletes/[id]/diagnostics] Supabase error", {
      code: error.code,
      message: error.message,
    });
    return jsonError({ error: "Nie udało się pobrać znalezisk." }, 500);
  }

  return NextResponse.json({ data: data ?? [] }, { headers: NO_STORE_HEADERS });
}

/**
 * POST /api/athletes/[id]/diagnostics
 * Creates one FMS finding for an athlete owned by the authenticated coach.
 * A duplicate (athlete, muscle, side) returns 409 - never silently overwrites.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "POST /api/athletes/[id]/diagnostics",
  );
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createDiagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({ error: "Validation failed", issues: parsed.error.issues }, 400);
  }

  const athleteCheck = await ensureAthleteExists(
    supabase,
    id,
    "POST /api/athletes/[id]/diagnostics",
    "Nie udało się dodać znaleziska.",
  );
  if (athleteCheck) return athleteCheck;

  const { data, error } = await supabase
    .from("diagnostic_findings")
    .insert({
      athlete_id: id,
      ...parsed.data,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23503") {
      return jsonError({ error: ATHLETE_NOT_FOUND_ERROR }, 404);
    }

    if (error.code === UNIQUE_VIOLATION_CODE) {
      return jsonError({ error: CONFLICT_ERROR }, 409);
    }

    console.error("[POST /api/athletes/[id]/diagnostics] Supabase error", {
      code: error.code,
      message: error.message,
    });
    return jsonError({ error: "Nie udało się dodać znaleziska." }, 500);
  }

  if (!data) {
    return jsonError({ error: ATHLETE_NOT_FOUND_ERROR }, 404);
  }

  return NextResponse.json({ data }, { status: 201, headers: NO_STORE_HEADERS });
}