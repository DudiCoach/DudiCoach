import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById } from "@/lib/data/athlete";
import { getProgressions, createProgression } from "@/lib/data/progression";
import { createProgressionSchema } from "@/lib/validation/progression";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const exerciseFilter = searchParams.get("exercise");

  // session cookie auth
  const { response } = await requireAuth( "GET /api/athletes/[id]/progressions");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    const result = await getProgressions(id);
    // Optional: filter by exercise in-memory (Firestore supports it but simpler here)
    if (exerciseFilter) {
      result.data = result.data.filter((p) => p.exercise_name === exerciseFilter);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/athletes/[id]/progressions] error", error);
    return NextResponse.json({ error: "Nie udało się pobrać progresji." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // session cookie auth
  const { response } = await requireAuth( "POST /api/athletes/[id]/progressions");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createProgressionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    const data = await createProgression(id, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athletes/[id]/progressions] error", error);
    return NextResponse.json({ error: "Nie udało się dodać progresji." }, { status: 500 });
  }
}
