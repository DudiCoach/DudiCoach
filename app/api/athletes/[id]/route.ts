import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById, updateAthlete, deleteAthlete } from "@/lib/data/athlete";
import { updateAthleteSchema } from "@/lib/validation/athlete";

type RouteContext = { params: Promise<{ id: string }> };

function normalizeEmptyOptionFields(input: Record<string, unknown>) {
  const normalized = { ...input };
  for (const key of ["goal", "current_phase", "training_start_date"]) {
    if (normalized[key] === "") delete normalized[key];
  }
  return normalized;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // session cookie auth
  const { response } = await requireAuth( "GET /api/athletes/[id]");
  if (response) return response;

  try {
    const data = await getAthleteById(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/athletes/[id]] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // session cookie auth
  const { response } = await requireAuth( "PATCH /api/athletes/[id]");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateAthleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }
  const normalized = normalizeEmptyOptionFields(parsed.data as Record<string, unknown>);

  try {
    const existing = await getAthleteById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await updateAthlete(id, normalized);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[PATCH /api/athletes/[id]] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // session cookie auth
  const { response } = await requireAuth( "DELETE /api/athletes/[id]");
  if (response) return response;

  try {
    const existing = await getAthleteById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteAthlete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/athletes/[id]] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
