import type { Tables } from "@/lib/supabase/database.types";
import type {
  CreateDiagnosticInput,
  UpdateDiagnosticInput,
} from "@/lib/validation/diagnostic";

export type DiagnosticFinding = Tables<"diagnostic_findings">;

export const diagnosticKeys = {
  all: (athleteId: string) => ["athletes", athleteId, "diagnostics"] as const,
  list: (athleteId: string) =>
    [...diagnosticKeys.all(athleteId), "list"] as const,
};

export async function fetchDiagnostics(
  athleteId: string,
): Promise<DiagnosticFinding[]> {
  const response = await fetch(`/api/athletes/${athleteId}/diagnostics`);
  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to fetch diagnostics");
  }
  const json = (await response.json()) as { data: DiagnosticFinding[] };
  return json.data;
}

export async function createDiagnostic(
  athleteId: string,
  input: CreateDiagnosticInput,
): Promise<DiagnosticFinding> {
  const response = await fetch(`/api/athletes/${athleteId}/diagnostics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to create diagnostic finding");
  }

  const json = (await response.json()) as { data: DiagnosticFinding };
  return json.data;
}

export async function updateDiagnostic(
  athleteId: string,
  findingId: string,
  input: UpdateDiagnosticInput,
): Promise<DiagnosticFinding> {
  const response = await fetch(
    `/api/athletes/${athleteId}/diagnostics/${findingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to update diagnostic finding");
  }

  const json = (await response.json()) as { data: DiagnosticFinding };
  return json.data;
}

export async function deleteDiagnostic(
  athleteId: string,
  findingId: string,
): Promise<void> {
  const response = await fetch(
    `/api/athletes/${athleteId}/diagnostics/${findingId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const json = (await response.json()) as { error?: string };
    throw new Error(json.error ?? "Failed to delete diagnostic finding");
  }
}