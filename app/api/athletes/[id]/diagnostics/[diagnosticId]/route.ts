import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById } from "@/lib/data/athlete";
import { updateFmsDiagnostic, deleteFmsDiagnostic } from "@/lib/data/fms-diagnostic";
import { updateFmsDiagnosticSchema } from "@/lib/validation/fms-diagnostic";

type RouteContext = { params: Promise<{ id: string; diagnosticId: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id, diagnosticId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "PUT /api/athletes/[id]/diagnostics/[diagnosticId]");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateFmsDiagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await updateFmsDiagnostic(id, diagnosticId, parsed.data);
    return NextResponse.json({ data: { id: diagnosticId, athlete_id: id, ...parsed.data } });
  } catch (error) {
    console.error("[PUT /api/athletes/[id]/diagnostics/[diagnosticId]] error", error);
    return NextResponse.json({ error: "Nie udało się zaktualizować diagnostyki FMS." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id, diagnosticId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "DELETE /api/athletes/[id]/diagnostics/[diagnosticId]");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await deleteFmsDiagnostic(id, diagnosticId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/athletes/[id]/diagnostics/[diagnosticId]] error", error);
    return NextResponse.json({ error: "Nie udało się usunąć diagnostyki FMS." }, { status: 500 });
  }
}
