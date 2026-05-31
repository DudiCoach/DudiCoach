import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById } from "@/lib/data/athlete";
import { updateInjury, deleteInjury } from "@/lib/data/injury";
import { updateInjurySchema } from "@/lib/validation/injury";

type RouteContext = { params: Promise<{ id: string; injuryId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id, injuryId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "PATCH /api/athletes/[id]/injuries/[injuryId]");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateInjurySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await updateInjury(id, injuryId, parsed.data);
    return NextResponse.json({ data: { id: injuryId, athlete_id: id, ...parsed.data } });
  } catch (error) {
    console.error("[PATCH /api/athletes/[id]/injuries/[injuryId]] error", error);
    return NextResponse.json({ error: "Nie udało się zaktualizować kontuzji." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id, injuryId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "DELETE /api/athletes/[id]/injuries/[injuryId]");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await deleteInjury(id, injuryId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/athletes/[id]/injuries/[injuryId]] error", error);
    return NextResponse.json({ error: "Nie udało się usunąć kontuzji." }, { status: 500 });
  }
}
