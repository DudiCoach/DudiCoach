import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeExerciseName,
  updateProgressionSchema,
} from "@/lib/validation/progression";

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

const NOT_FOUND_ERROR_CODE = "PGRST116";
const UNIQUE_VIOLATION_CODE = "23505";
const ENTRY_NOT_FOUND_ERROR = "Nie znaleziono wpisu progresji.";
const CONFLICT_ERROR = "Wpis progresji dla tego ćwiczenia i dnia już istnieje.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function isNotFoundError(error: { code?: string } | null): boolean {
  return error?.code === NOT_FOUND_ERROR_CODE;
}

/**
 * PATCH /api/athletes/[id]/progressions/[entryId]
 * Partial update of one load progression entry. Unique conflicts return 409.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "PATCH /api/athletes/[id]/progressions/[entryId]",
  );
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateProgressionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({ error: "Validation failed", issues: parsed.error.issues }, 400);
  }

  if (Object.values(parsed.data).every((value) => value === undefined)) {
    return jsonError(
      { error: "Nie podano żadnych pól do aktualizacji." },
      400,
    );
  }

  const patch = {
    exercise_name: parsed.data.exercise_name !== undefined
      ? normalizeExerciseName(parsed.data.exercise_name)
      : undefined,
    entry_date: parsed.data.entry_date,
    weight_kg: parsed.data.weight_kg,
    reps: parsed.data.reps,
    sets: parsed.data.sets,
    note: parsed.data.note,
  };
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[key] === undefined) delete patch[key];
  }

  const { data, error } = await supabase
    .from("load_progressions")
    .update(patch)
    .eq("athlete_id", id)
    .eq("id", entryId)
    .select("*")
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return jsonError({ error: ENTRY_NOT_FOUND_ERROR }, 404);
    }

    if (error.code === UNIQUE_VIOLATION_CODE) {
      return jsonError({ error: CONFLICT_ERROR }, 409);
    }

    console.error(
      "[PATCH /api/athletes/[id]/progressions/[entryId]] Supabase error",
      {
        code: error.code,
        message: error.message,
      },
    );
    return jsonError({ error: "Nie udało się zaktualizować wpisu progresji." }, 500);
  }

  if (!data) {
    return jsonError({ error: ENTRY_NOT_FOUND_ERROR }, 404);
  }

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

/**
 * DELETE /api/athletes/[id]/progressions/[entryId]
 * Deletes one load progression entry.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id, entryId } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "DELETE /api/athletes/[id]/progressions/[entryId]",
  );
  if (response) return response;

  const { error, count } = await supabase
    .from("load_progressions")
    .delete({ count: "exact" })
    .eq("athlete_id", id)
    .eq("id", entryId);

  if (error) {
    console.error(
      "[DELETE /api/athletes/[id]/progressions/[entryId]] Supabase error",
      {
        code: error.code,
        message: error.message,
      },
    );
    return jsonError({ error: "Nie udało się usunąć wpisu progresji." }, 500);
  }

  if (count === 0) {
    return jsonError({ error: ENTRY_NOT_FOUND_ERROR }, 404);
  }

  return new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  });
}