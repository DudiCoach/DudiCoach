import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById } from "@/lib/data/athlete";
import { updateProgression, deleteProgression } from "@/lib/data/progression";
import { updateProgressionSchema } from "@/lib/validation/progression";

type RouteContext = { params: Promise<{ id: string; progressionId: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id, progressionId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "PUT /api/athletes/[id]/progressions/[progressionId]");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProgressionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await updateProgression(id, progressionId, parsed.data as Partial<{ exercise_name: string; weight_kg: number; reps: string; sets: string; note: string | null }>);
    return NextResponse.json({ data: { id: progressionId, athlete_id: id, ...parsed.data } });
  } catch (error) {
    console.error("[PUT /api/athletes/[id]/progressions/[progressionId]] error", error);
    return NextResponse.json({ error: "Nie udało się zaktualizować progresji." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id, progressionId } = await params;
  // session cookie auth
  const { response } = await requireAuth( "DELETE /api/athletes/[id]/progressions/[progressionId]");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    await deleteProgression(id, progressionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/athletes/[id]/progressions/[progressionId]] error", error);
    return NextResponse.json({ error: "Nie udało się usunąć progresji." }, { status: 500 });
  }
}
