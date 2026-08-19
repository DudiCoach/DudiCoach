import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updateDiagnosticSchema } from "@/lib/validation/diagnostic";

type RouteContext = { params: Promise<{ id: string; findingId: string }> };

const NOT_FOUND_ERROR_CODE = "PGRST116";
const UNIQUE_VIOLATION_CODE = "23505";
const FINDING_NOT_FOUND_ERROR = "Nie znaleziono znaleziska.";
const CONFLICT_ERROR = "Znalezisko dla tego mięśnia i strony już istnieje.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function isNotFoundError(error: { code?: string } | null): boolean {
  return error?.code === NOT_FOUND_ERROR_CODE;
}

/**
 * PATCH /api/athletes/[id]/diagnostics/[findingId]
 * Partial update of one FMS finding row. Unique conflicts return 409.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id, findingId } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "PATCH /api/athletes/[id]/diagnostics/[findingId]",
  );
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateDiagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError({ error: "Validation failed", issues: parsed.error.issues }, 400);
  }

  if (Object.values(parsed.data).every((value) => value === undefined)) {
    return jsonError({ error: "Nie podano żadnych pól do aktualizacji." }, 400);
  }

  const { data, error } = await supabase
    .from("diagnostic_findings")
    .update(parsed.data)
    .eq("athlete_id", id)
    .eq("id", findingId)
    .select("*")
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      return jsonError({ error: FINDING_NOT_FOUND_ERROR }, 404);
    }

    if (error.code === UNIQUE_VIOLATION_CODE) {
      return jsonError({ error: CONFLICT_ERROR }, 409);
    }

    console.error(
      "[PATCH /api/athletes/[id]/diagnostics/[findingId]] Supabase error",
      {
        code: error.code,
        message: error.message,
      },
    );
    return jsonError({ error: "Nie udało się zaktualizować znaleziska." }, 500);
  }

  if (!data) {
    return jsonError({ error: FINDING_NOT_FOUND_ERROR }, 404);
  }

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

/**
 * DELETE /api/athletes/[id]/diagnostics/[findingId]
 * Deletes one FMS finding row.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id, findingId } = await params;
  const supabase = await createClient();

  const { response } = await requireAuth(
    supabase,
    "DELETE /api/athletes/[id]/diagnostics/[findingId]",
  );
  if (response) return response;

  const { error, count } = await supabase
    .from("diagnostic_findings")
    .delete({ count: "exact" })
    .eq("athlete_id", id)
    .eq("id", findingId);

  if (error) {
    console.error(
      "[DELETE /api/athletes/[id]/diagnostics/[findingId]] Supabase error",
      {
        code: error.code,
        message: error.message,
      },
    );
    return jsonError({ error: "Nie udało się usunąć znaleziska." }, 500);
  }

  if (count === 0) {
    return jsonError({ error: FINDING_NOT_FOUND_ERROR }, 404);
  }

  return new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  });
}