import { getDb } from "@/lib/firebase/admin";

// =============================================================================
// TYPES
// =============================================================================

export interface ExerciseVideo {
  id: string;
  exerciseName: string;
  youtubeUrl: string;
  title: string;
  description: string;
  createdAt: string;
}

interface FirestoreExerciseVideo {
  exerciseName: string;
  youtubeUrl: string;
  title: string;
  description: string;
  createdAt: string;
}

function toResponse(id: string, doc: FirestoreExerciseVideo): ExerciseVideo {
  return {
    id,
    exerciseName: doc.exerciseName,
    youtubeUrl: doc.youtubeUrl,
    title: doc.title,
    description: doc.description,
    createdAt: doc.createdAt,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VIDEOS_COLLECTION = "exercise_videos";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract YouTube video ID from various YouTube URL formats.
 */
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all exercise videos.
 */
export async function getExerciseVideos(): Promise<ExerciseVideo[]> {
  const snapshot = await getDb()
    .collection(VIDEOS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreExerciseVideo));
}

/**
 * Get exercise videos by exercise name.
 */
export async function getExerciseVideosByName(exerciseName: string): Promise<ExerciseVideo[]> {
  const snapshot = await getDb()
    .collection(VIDEOS_COLLECTION)
    .where("exerciseName", "==", exerciseName)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => toResponse(doc.id, doc.data() as FirestoreExerciseVideo));
}

/**
 * Create an exercise video.
 */
export async function createExerciseVideo(input: {
  exercise_name: string;
  youtube_url: string;
  title?: string;
  description?: string;
}): Promise<ExerciseVideo> {
  const now = new Date().toISOString();
  const doc: FirestoreExerciseVideo = {
    exerciseName: input.exercise_name,
    youtubeUrl: input.youtube_url,
    title: input.title ?? input.exercise_name,
    description: input.description ?? "",
    createdAt: now,
  };

  const docRef = await getDb().collection(VIDEOS_COLLECTION).add(doc);
  return toResponse(docRef.id, doc);
}

/**
 * Delete an exercise video.
 */
export async function deleteExerciseVideo(videoId: string): Promise<void> {
  await getDb().collection(VIDEOS_COLLECTION).doc(videoId).delete();
}
