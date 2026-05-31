import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/api/auth-guard";
import { getAthleteById, updateAthlete } from "@/lib/data/athlete";

// Next.js 16: params is a Promise — must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Body schema
//
// Share management is an explicit action — not a free-form PATCH on the
// athlete row. We narrow the surface to three operations:
//   • activate   — flip share_active=true (code preserved)
//   • deactivate — flip share_active=false (code preserved but inert)
//   • reset      — generate a brand-new code, keep share_active=true
// ---------------------------------------------------------------------------

const shareActionSchema = z.object({
  action: z.enum(["activate", "deactivate", "reset"]),
});

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * POST /api/athletes/[id]/share
 * Coach action: activate/deactivate sharing or reset the share code.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const { response } = await requireAuth("POST /api/athletes/[id]/share");
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = shareActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { action } = parsed.data;

  const athlete = await getAthleteById(id);
  if (!athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "activate" || action === "deactivate") {
    await updateAthlete(id, { share_active: action === "activate" });
    return NextResponse.json({
      data: {
        share_code: athlete.share_code,
        share_active: action === "activate",
      },
    });
  }

  // reset: generate new code and activate
  const newCode = generateShareCode();
  await updateAthlete(id, { share_code: newCode, share_active: true });

  return NextResponse.json({
    data: { share_code: newCode, share_active: true },
  });
}
