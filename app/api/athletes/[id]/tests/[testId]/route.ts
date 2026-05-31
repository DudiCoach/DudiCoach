import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";
import { deleteFitnessTestResult } from "@/lib/data/fitness-test";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

/**
 * DELETE /api/athletes/[id]/tests/[testId]
 * Deletes one fitness test result row.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id, testId } = await params;

  const { response } = await requireAuth("DELETE /api/athletes/[id]/tests/[testId]");
  if (response) return response;

  const deleted = await deleteFitnessTestResult(id, testId);

  if (!deleted) {
    return NextResponse.json(
      { error: "Nie znaleziono wyniku testu." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
