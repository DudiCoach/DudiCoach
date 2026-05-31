import {
  getAthleteById as fbGetAthlete,
  getAthleteByShareCode as fbGetByShareCode,
  getAthletesByCoach as fbGetByCoach,
  createAthlete as fbCreate,
  updateAthlete as fbUpdate,
  deleteAthlete as fbDelete,
} from "@/lib/firebase/admin";

// Unified types — snake_case for API responses, camelCase internally
export interface Athlete {
  id: string;
  coach_id: string;
  name: string;
  age?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  sport?: string | null;
  training_start_date?: string | null;
  training_days_per_week?: number | null;
  session_minutes?: number | null;
  current_phase?: string | null;
  goal?: string | null;
  notes?: string | null;
  share_code: string;
  share_active: boolean;
  created_at: string;
  updated_at: string;
}

// Firestore writes use camelCase
interface FirestoreDoc {
  coachId: string;
  name: string;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  sport?: string | null;
  trainingStartDate?: string | null;
  trainingDaysPerWeek?: number | null;
  sessionMinutes?: number | null;
  currentPhase?: string | null;
  goal?: string | null;
  notes?: string | null;
  shareCode: string;
  shareActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function toResponse(id: string, doc: FirestoreDoc): Athlete {
  return {
    id,
    coach_id: doc.coachId,
    name: doc.name,
    age: doc.age,
    weight_kg: doc.weightKg,
    height_cm: doc.heightCm,
    sport: doc.sport,
    training_start_date: doc.trainingStartDate,
    training_days_per_week: doc.trainingDaysPerWeek,
    session_minutes: doc.sessionMinutes,
    current_phase: doc.currentPhase,
    goal: doc.goal,
    notes: doc.notes,
    share_code: doc.shareCode,
    share_active: doc.shareActive,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function toFirestore(input: Partial<Athlete>): Partial<FirestoreDoc> {
  const out: Partial<FirestoreDoc> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.age !== undefined) out.age = input.age;
  if (input.weight_kg !== undefined) out.weightKg = input.weight_kg;
  if (input.height_cm !== undefined) out.heightCm = input.height_cm;
  if (input.sport !== undefined) out.sport = input.sport;
  if (input.training_start_date !== undefined) out.trainingStartDate = input.training_start_date;
  if (input.training_days_per_week !== undefined) out.trainingDaysPerWeek = input.training_days_per_week;
  if (input.session_minutes !== undefined) out.sessionMinutes = input.session_minutes;
  if (input.current_phase !== undefined) out.currentPhase = input.current_phase;
  if (input.goal !== undefined) out.goal = input.goal;
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function getAthletesByCoach(coachId: string): Promise<Athlete[]> {
  const results = await fbGetByCoach(coachId);
  return results.map(({ id, data }) => toResponse(id, data));
}

export async function getAthleteById(id: string): Promise<Athlete | null> {
  const result = await fbGetAthlete(id);
  if (!result) return null;
  return toResponse(result.id, result.data);
}

export async function getAthleteByShareCode(code: string): Promise<Athlete | null> {
  const result = await fbGetByShareCode(code);
  if (!result) return null;
  return toResponse(result.id, result.data);
}

export async function createAthlete(
  coachId: string,
  input: Partial<Athlete>,
): Promise<Athlete> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let shareCode = "";
  for (let i = 0; i < 6; i++) {
    shareCode += chars[Math.floor(Math.random() * chars.length)];
  }

  const now = new Date().toISOString();
  const doc: FirestoreDoc = {
    coachId,
    name: input.name ?? "",
    age: input.age,
    weightKg: input.weight_kg,
    heightCm: input.height_cm,
    sport: input.sport,
    trainingStartDate: input.training_start_date,
    trainingDaysPerWeek: input.training_days_per_week,
    sessionMinutes: input.session_minutes,
    currentPhase: input.current_phase,
    goal: input.goal,
    notes: input.notes,
    shareCode,
    shareActive: false,
    createdAt: now,
    updatedAt: now,
  };

  const { id, data } = await fbCreate(doc);
  return toResponse(id, data);
}

export async function updateAthlete(
  id: string,
  input: Partial<Athlete>,
): Promise<Athlete> {
  const firestoreData = toFirestore(input);
  firestoreData.updatedAt = new Date().toISOString();
  await fbUpdate(id, firestoreData);

  const updated = await fbGetAthlete(id);
  if (!updated) throw new Error("Athlete not found after update");
  return toResponse(updated.id, updated.data);
}

export async function deleteAthlete(id: string): Promise<void> {
  await fbDelete(id);
}
