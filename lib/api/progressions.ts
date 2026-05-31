import type {
  CreateProgressionInput,
  UpdateProgressionInput,
} from "@/lib/validation/progression";

export interface Progression {
  id: string;
  athlete_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: string;
  sets: string;
  note?: string | null;
  source: string;
  created_at: string;
}

export const progressionKeys = {
  all: (athleteId: string) =>
    ["athletes", athleteId, "progressions"] as const,
  list: (athleteId: string) =>
    [...progressionKeys.all(athleteId), "list"] as const,
  byExercise: (athleteId: string, exercise: string) =>
    [...progressionKeys.list(athleteId), { exercise }] as const,
};

export async function fetchProgressions(
  athleteId: string,
  exercise?: string,
): Promise<{ data: Progression[]; exercises: string[] }> {
  const params = new URLSearchParams();
  if (exercise) params.set("exercise", exercise);

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/athletes/${athleteId}/progressions${query}`);

  if (!response.ok) {
    throw new Error("Failed to fetch progressions");
  }

  const json = (await response.json()) as {
    data: Progression[];
    exercises: string[];
  };
  return json;
}

export async function createProgression(
  athleteId: string,
  input: CreateProgressionInput,
): Promise<Progression> {
  const response = await fetch(`/api/athletes/${athleteId}/progressions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to create progression");
  }

  const json = (await response.json()) as { data: Progression };
  return json.data;
}

export async function updateProgression(
  athleteId: string,
  progressionId: string,
  input: UpdateProgressionInput,
): Promise<Progression> {
  const response = await fetch(
    `/api/athletes/${athleteId}/progressions/${progressionId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to update progression");
  }

  const json = (await response.json()) as { data: Progression };
  return json.data;
}

export async function deleteProgression(
  athleteId: string,
  progressionId: string,
): Promise<void> {
  const response = await fetch(
    `/api/athletes/${athleteId}/progressions/${progressionId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to delete progression");
  }
}
