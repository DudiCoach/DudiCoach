import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { updateDiagnosticSchema } from "@/lib/validation/diagnostic";

type RouteContext = { params: Promise<{ id: string; findingId: string }> };

const NOT_FOUND_ERROR_CODE = "PGRST116";
const UNIQUE_VIOLATION_CODE = "23505";
const FINDING_NOT_FOUND_ERROR = "Nie znaleziono znaleziska.";
const CONFLICT_ERROR = "Znalezisko dla tego mięśnia i strony już istnieje.";

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateDiagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
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
      return NextResponse.json(
        { error: FINDING_NOT_FOUND_ERROR },
        { status: 404 },
      );
    }

    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json(
        { error: CONFLICT_ERROR },
        { status: 409 },
      );
    }

    console.error(
      "[PATCH /api/athletes/[id]/diagnostics/[findingId]] Supabase error",
      {
        code: error.code,
        message: error.message,
      },
    );
    return NextResponse.json(
      { error: "Nie udało się zaktualizować znaleziska." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: FINDING_NOT_FOUND_ERROR },
      { status: 404 },
    );
  }

  return NextResponse.json({ data });
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
    return NextResponse.json(
      { error: "Nie udało się usunąć znaleziska." },
      { status: 500 },
    );
  }

  if (count === 0) {
    return NextResponse.json(
      { error: FINDING_NOT_FOUND_ERROR },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}