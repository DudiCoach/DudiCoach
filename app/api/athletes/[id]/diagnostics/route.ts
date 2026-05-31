import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthleteById } from "@/lib/data/athlete";
import { getFmsDiagnostics, createFmsDiagnostic } from "@/lib/data/fms-diagnostic";
import { createFmsDiagnosticSchema } from "@/lib/validation/fms-diagnostic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // session cookie auth
  const { response } = await requireAuth( "GET /api/athletes/[id]/diagnostics");
  if (response) return response;

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });
    const data = await getFmsDiagnostics(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/athletes/[id]/diagnostics] error", error);
    return NextResponse.json({ error: "Nie udało się pobrać diagnostyki FMS." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { user, response } = await requireAuth("POST /api/athletes/[id]/diagnostics");
  if (response) return response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createFmsDiagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const athlete = await getAthleteById(id);
    if (!athlete) return NextResponse.json({ error: "Nie znaleziono zawodnika." }, { status: 404 });

    const data = await createFmsDiagnostic(id, user.uid, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athletes/[id]/diagnostics] error", error);
    return NextResponse.json({ error: "Nie udało się dodać diagnostyki FMS." }, { status: 500 });
  }
}
