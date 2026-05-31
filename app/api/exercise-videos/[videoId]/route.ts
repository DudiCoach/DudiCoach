import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import { deleteExerciseVideo } from "@/lib/data/exercise-video";

type RouteContext = { params: Promise<{ videoId: string }> };

/**
 * DELETE /api/exercise-videos/[videoId]
 * Coach-only endpoint. Deletes an exercise video.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { videoId } = await params;

  // session cookie auth
  const { response } = await requireAuth(
    "DELETE /api/exercise-videos/[videoId]",
  );
  if (response) return response;

  try {
    await deleteExerciseVideo(videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/exercise-videos/[videoId]] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
