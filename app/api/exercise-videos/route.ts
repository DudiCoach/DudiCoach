import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth-guard";

import {
  getExerciseVideos,
  getExerciseVideosByName,
  createExerciseVideo,
} from "@/lib/data/exercise-video";
import { exerciseVideoSchema } from "@/lib/validation/exercise-video";

/**
 * GET /api/exercise-videos
 * Public endpoint. Returns all exercise videos, optionally filtered by name.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const exerciseName = url.searchParams.get("exercise_name");

    let videos;
    if (exerciseName) {
      videos = await getExerciseVideosByName(exerciseName);
    } else {
      videos = await getExerciseVideos();
    }

    return NextResponse.json({ data: videos });
  } catch (error) {
    console.error("[GET /api/exercise-videos] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/exercise-videos
 * Coach-only endpoint. Creates a new exercise video.
 */
export async function POST(request: NextRequest) {
  // session cookie auth
  const { response } = await requireAuth(
    "POST /api/exercise-videos",
  );
  if (response) return response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = exerciseVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const video = await createExerciseVideo({
      exercise_name: parsed.data.exercise_name,
      youtube_url: parsed.data.youtube_url,
      title: parsed.data.title,
      description: parsed.data.description,
    });

    return NextResponse.json({ data: video }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/exercise-videos] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
