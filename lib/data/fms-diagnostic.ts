import {
  getFmsDiagnostics as fbGet,
  createFmsDiagnostic as fbCreate,
  updateFmsDiagnostic as fbUpdate,
  deleteFmsDiagnostic as fbDelete,
} from "@/lib/firebase/admin";

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

interface FirestoreDoc {
  coachId: string;
  region: string;
  side: string;
  muscle: string;
  severity: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, athleteId: string, doc: FirestoreDoc): FmsDiagnostic {
  return {
    id,
    athlete_id: athleteId,
    coach_id: doc.coachId,
    region: doc.region,
    side: doc.side,
    muscle: doc.muscle,
    severity: doc.severity,
    notes: doc.notes,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

export async function getFmsDiagnostics(athleteId: string): Promise<FmsDiagnostic[]> {
  const results = await fbGet(athleteId);
  return results.map(({ id, data }) => toResponse(id, athleteId, data));
}

export async function createFmsDiagnostic(
  athleteId: string,
  coachId: string,
  input: {
    region: string;
    side: string;
    muscle: string;
    severity: string;
    notes?: string | null;
  },
): Promise<FmsDiagnostic> {
  const now = new Date().toISOString();
  const doc: FirestoreDoc = {
    coachId,
    region: input.region,
    side: input.side,
    muscle: input.muscle,
    severity: input.severity,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  const { id, data } = await fbCreate(athleteId, doc);
  return toResponse(id, athleteId, data);
}

export async function updateFmsDiagnostic(
  athleteId: string,
  diagnosticId: string,
  input: Partial<{ region: string; side: string; muscle: string; severity: string; notes: string | null }>,
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (input.region !== undefined) updateData.region = input.region;
  if (input.side !== undefined) updateData.side = input.side;
  if (input.muscle !== undefined) updateData.muscle = input.muscle;
  if (input.severity !== undefined) updateData.severity = input.severity;
  if (input.notes !== undefined) updateData.notes = input.notes;
  updateData.updatedAt = new Date().toISOString();
  await fbUpdate(athleteId, diagnosticId, updateData);
}

export async function deleteFmsDiagnostic(athleteId: string, diagnosticId: string): Promise<void> {
  await fbDelete(athleteId, diagnosticId);
}
