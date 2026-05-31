import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { getAthletesByCoach, createAthlete } from "@/lib/data/athlete";
import { createAthleteSchema } from "@/lib/validation/athlete";

export async function POST(request: NextRequest) {
  // session cookie auth
  const { user, response } = await requireAuth( "POST /api/athletes");
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAthleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  try {
    const data = await createAthlete(user.uid, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/athletes] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  // session cookie auth
  const { user, response } = await requireAuth( "GET /api/athletes");
  if (response) return response;

  try {
    const data = await getAthletesByCoach(user.uid);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/athletes] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
