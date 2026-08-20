import type { Tables } from "@/lib/supabase/database.types";
import type {
  CreateProgressionInput,
  UpdateProgressionInput,
} from "@/lib/validation/progression";

export type LoadProgression = Tables<"load_progressions">;

export const progressionKeys = {
  all: (athleteId: string) => ["athletes", athleteId, "progressions"] as const,
  list: (athleteId: string) =>
    [...progressionKeys.all(athleteId), "list"] as const,
};

export async function fetchProgressions(
  athleteId: string,
): Promise<LoadProgression[]> {
  const response = await fetch(`/api/athletes/${athleteId}/progressions`);
  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to fetch progressions");
  }
  const json = (await response.json()) as { data: LoadProgression[] };
  return json.data;
}

export async function createProgression(
  athleteId: string,
  input: CreateProgressionInput,
): Promise<LoadProgression> {
  const response = await fetch(`/api/athletes/${athleteId}/progressions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to create progression entry");
  }

  const json = (await response.json()) as { data: LoadProgression };
  return json.data;
}

export async function updateProgression(
  athleteId: string,
  entryId: string,
  input: UpdateProgressionInput,
): Promise<LoadProgression> {
  const response = await fetch(
    `/api/athletes/${athleteId}/progressions/${entryId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to update progression entry");
  }

  const json = (await response.json()) as { data: LoadProgression };
  return json.data;
}

export async function deleteProgression(
  athleteId: string,
  entryId: string,
): Promise<void> {
  const response = await fetch(
    `/api/athletes/${athleteId}/progressions/${entryId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to delete progression entry");
  }
}