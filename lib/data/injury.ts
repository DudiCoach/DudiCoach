import {
  getInjuries as fbGetInjuries,
  createInjury as fbCreateInjury,
  updateInjury as fbUpdateInjury,
  deleteInjury as fbDeleteInjury,
} from "@/lib/firebase/admin";

export interface Injury {
  id: string;
  athlete_id: string;
  name: string;
  body_location: string;
  severity: number;
  injury_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FirestoreInjury {
  name: string;
  bodyLocation: string;
  severity: number;
  injuryDate: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, athleteId: string, doc: FirestoreInjury): Injury {
  return {
    id,
    athlete_id: athleteId,
    name: doc.name,
    body_location: doc.bodyLocation,
    severity: doc.severity,
    injury_date: doc.injuryDate,
    status: doc.status,
    notes: doc.notes ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function getInjuries(athleteId: string): Promise<Injury[]> {
  const results = await fbGetInjuries(athleteId);
  return results.map(({ id, data }) => toResponse(id, athleteId, data));
}

export async function createInjury(
  athleteId: string,
  input: {
    name: string;
    body_location: string;
    severity: number;
    injury_date: string;
    status?: string;
    notes?: string | null;
  },
): Promise<Injury> {
  const now = new Date().toISOString();
  const doc: FirestoreInjury = {
    name: input.name,
    bodyLocation: input.body_location,
    severity: input.severity,
    injuryDate: input.injury_date,
    status: input.status ?? "active",
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  const { id, data } = await fbCreateInjury(athleteId, doc);
  return toResponse(id, athleteId, data);
}

export async function updateInjury(
  athleteId: string,
  injuryId: string,
  input: Partial<{
    name: string;
    body_location: string;
    severity: number;
    injury_date: string;
    status: string;
    notes: string | null;
  }>,
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.body_location !== undefined) updateData.bodyLocation = input.body_location;
  if (input.severity !== undefined) updateData.severity = input.severity;
  if (input.injury_date !== undefined) updateData.injuryDate = input.injury_date;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.notes !== undefined) updateData.notes = input.notes;
  updateData.updatedAt = new Date().toISOString();

  await fbUpdateInjury(athleteId, injuryId, updateData);
}

export async function deleteInjury(
  athleteId: string,
  injuryId: string,
): Promise<void> {
  await fbDeleteInjury(athleteId, injuryId);
}
