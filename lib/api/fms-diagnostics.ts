import type {
  CreateFmsDiagnosticInput,
  UpdateFmsDiagnosticInput,
} from "@/lib/validation/fms-diagnostic";

export interface FmsDiagnostic {
  id: string;
  athlete_id: string;
  coach_id: string;
  region: string;
  side: string;
  muscle: string;
  severity: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const fmsDiagnosticKeys = {
  all: (athleteId: string) =>
    ["athletes", athleteId, "fms_diagnostics"] as const,
  list: (athleteId: string) =>
    [...fmsDiagnosticKeys.all(athleteId), "list"] as const,
};

export async function fetchFmsDiagnostics(
  athleteId: string,
): Promise<FmsDiagnostic[]> {
  const response = await fetch(`/api/athletes/${athleteId}/diagnostics`);
  if (!response.ok) {
    throw new Error("Failed to fetch FMS diagnostics");
  }
  const json = (await response.json()) as { data: FmsDiagnostic[] };
  return json.data;
}

export async function createFmsDiagnostic(
  athleteId: string,
  input: CreateFmsDiagnosticInput,
): Promise<FmsDiagnostic> {
  const response = await fetch(`/api/athletes/${athleteId}/diagnostics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to create FMS diagnostic");
  }

  const json = (await response.json()) as { data: FmsDiagnostic };
  return json.data;
}

export async function updateFmsDiagnostic(
  athleteId: string,
  diagnosticId: string,
  input: UpdateFmsDiagnosticInput,
): Promise<FmsDiagnostic> {
  const response = await fetch(
    `/api/athletes/${athleteId}/diagnostics/${diagnosticId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to update FMS diagnostic");
  }

  const json = (await response.json()) as { data: FmsDiagnostic };
  return json.data;
}

export async function deleteFmsDiagnostic(
  athleteId: string,
  diagnosticId: string,
): Promise<void> {
  const response = await fetch(
    `/api/athletes/${athleteId}/diagnostics/${diagnosticId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to delete FMS diagnostic");
  }
}
