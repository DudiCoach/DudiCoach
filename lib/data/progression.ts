import {
  getProgressions as fbGet,
  getProgressionsByExercise as fbGetByExercise,
  createProgression as fbCreate,
  updateProgression as fbUpdate,
  deleteProgression as fbDelete,
} from "@/lib/firebase/admin";

export interface Progression {
  id: string;
  athlete_id: string;
  exercise_name: string;
  weight_kg: number;
  reps?: string | null;
  sets?: string | null;
  note?: string | null;
  source: string;
  created_at: string;
}

interface FirestoreDoc {
  exerciseName: string;
  weightKg: number;
  reps?: string | null;
  sets?: string | null;
  note?: string | null;
  source: string;
  createdAt: string;
}

function toResponse(id: string, athleteId: string, doc: FirestoreDoc): Progression {
  return {
    id,
    athlete_id: athleteId,
    exercise_name: doc.exerciseName,
    weight_kg: doc.weightKg,
    reps: doc.reps,
    sets: doc.sets,
    note: doc.note,
    source: doc.source,
    created_at: doc.createdAt,
  };
}

export async function getProgressions(athleteId: string): Promise<{ data: Progression[]; exercises: string[] }> {
  const results = await fbGet(athleteId);
  const data = results.map(({ id, data }) => toResponse(id, athleteId, data));
  const exercises = [...new Set(data.map((p) => p.exercise_name))];
  return { data, exercises };
}

export async function createProgression(
  athleteId: string,
  input: {
    exercise_name: string;
    weight_kg: number;
    reps?: string | null;
    sets?: string | null;
    note?: string | null;
    source?: string;
  },
): Promise<Progression> {
  const now = new Date().toISOString();
  const doc: FirestoreDoc = {
    exerciseName: input.exercise_name,
    weightKg: input.weight_kg,
    reps: input.reps,
    sets: input.sets,
    note: input.note,
    source: input.source ?? "coach",
    createdAt: now,
  };
  const { id, data } = await fbCreate(athleteId, doc);
  return toResponse(id, athleteId, data);
}

export async function updateProgression(
  athleteId: string,
  progressionId: string,
  input: Partial<{ exercise_name: string; weight_kg: number; reps: string; sets: string; note: string | null }>,
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (input.exercise_name !== undefined) updateData.exerciseName = input.exercise_name;
  if (input.weight_kg !== undefined) updateData.weightKg = input.weight_kg;
  if (input.reps !== undefined) updateData.reps = input.reps;
  if (input.sets !== undefined) updateData.sets = input.sets;
  if (input.note !== undefined) updateData.note = input.note;
  await fbUpdate(athleteId, progressionId, updateData);
}

export async function deleteProgression(athleteId: string, progressionId: string): Promise<void> {
  await fbDelete(athleteId, progressionId);
}
