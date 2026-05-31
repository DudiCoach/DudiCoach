import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

export function getFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // In production, use GOOGLE_APPLICATION_CREDENTIALS env var
  // In development, use the service account key file
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dudicoach-app";

  return initializeApp({
    projectId,
  });
}

export function getDb(): Firestore {
  if (!db) {
    app = getFirebaseAdmin();
    db = getFirestore(app);
  }
  return db;
}

// =============================================================================
// TYPES
// =============================================================================

export interface FirestoreAthlete {
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

export interface FirestoreInjury {
  name: string;
  bodyLocation: string;
  severity: number;
  injuryDate: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreFmsDiagnostic {
  coachId: string;
  region: string;
  side: string;
  muscle: string;
  severity: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreProgression {
  exerciseName: string;
  weightKg: number;
  reps?: string | null;
  sets?: string | null;
  note?: string | null;
  source: string;
  createdAt: string;
}

export interface FirestoreTrainingPlan {
  planName: string;
  phase?: string | null;
  planJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

// =============================================================================
// COLLECTIONS
// =============================================================================

const ATHLETES = "athletes";

// =============================================================================
// ATHLETES CRUD
// =============================================================================

export async function getAthletesByCoach(coachId: string): Promise<{ id: string; data: FirestoreAthlete }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .where("coachId", "==", coachId)
    .orderBy("updatedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreAthlete,
  }));
}

export async function getAthleteById(id: string): Promise<{ id: string; data: FirestoreAthlete } | null> {
  const doc = await getDb().collection(ATHLETES).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, data: doc.data() as FirestoreAthlete };
}

export async function getAthleteByShareCode(shareCode: string): Promise<{ id: string; data: FirestoreAthlete } | null> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .where("shareCode", "==", shareCode.toUpperCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, data: snapshot.docs[0].data() as FirestoreAthlete };
}

export async function createAthlete(data: FirestoreAthlete): Promise<{ id: string; data: FirestoreAthlete }> {
  const docRef = await getDb().collection(ATHLETES).add(data);
  return { id: docRef.id, data };
}

export async function updateAthlete(id: string, data: Partial<FirestoreAthlete>): Promise<void> {
  await getDb().collection(ATHLETES).doc(id).update(data);
}

export async function deleteAthlete(id: string): Promise<void> {
  // Delete all subcollections first
  const subcollections = ["injuries", "fms_diagnostics", "progressions", "training_plans"];
  for (const sub of subcollections) {
    const snapshot = await getDb().collection(ATHLETES).doc(id).collection(sub).get();
    const batch = getDb().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  // Delete the athlete document
  await getDb().collection(ATHLETES).doc(id).delete();
}

// =============================================================================
// INJURIES CRUD
// =============================================================================

export async function getInjuries(athleteId: string): Promise<{ id: string; data: FirestoreInjury }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("injuries")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreInjury,
  }));
}

export async function createInjury(athleteId: string, data: FirestoreInjury): Promise<{ id: string; data: FirestoreInjury }> {
  const docRef = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("injuries")
    .add(data);
  return { id: docRef.id, data };
}

export async function updateInjury(athleteId: string, injuryId: string, data: Partial<FirestoreInjury>): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("injuries")
    .doc(injuryId)
    .update(data);
}

export async function deleteInjury(athleteId: string, injuryId: string): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("injuries")
    .doc(injuryId)
    .delete();
}

// =============================================================================
// FMS DIAGNOSTICS CRUD
// =============================================================================

export async function getFmsDiagnostics(athleteId: string): Promise<{ id: string; data: FirestoreFmsDiagnostic }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("fms_diagnostics")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreFmsDiagnostic,
  }));
}

export async function createFmsDiagnostic(athleteId: string, data: FirestoreFmsDiagnostic): Promise<{ id: string; data: FirestoreFmsDiagnostic }> {
  const docRef = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("fms_diagnostics")
    .add(data);
  return { id: docRef.id, data };
}

export async function updateFmsDiagnostic(athleteId: string, diagnosticId: string, data: Partial<FirestoreFmsDiagnostic>): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("fms_diagnostics")
    .doc(diagnosticId)
    .update(data);
}

export async function deleteFmsDiagnostic(athleteId: string, diagnosticId: string): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("fms_diagnostics")
    .doc(diagnosticId)
    .delete();
}

// =============================================================================
// PROGRESSIONS CRUD
// =============================================================================

export async function getProgressions(athleteId: string): Promise<{ id: string; data: FirestoreProgression }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("progressions")
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreProgression,
  }));
}

export async function getProgressionsByExercise(athleteId: string, exerciseName: string): Promise<{ id: string; data: FirestoreProgression }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("progressions")
    .where("exerciseName", "==", exerciseName)
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreProgression,
  }));
}

export async function createProgression(athleteId: string, data: FirestoreProgression): Promise<{ id: string; data: FirestoreProgression }> {
  const docRef = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("progressions")
    .add(data);
  return { id: docRef.id, data };
}

export async function updateProgression(athleteId: string, progressionId: string, data: Partial<FirestoreProgression>): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("progressions")
    .doc(progressionId)
    .update(data);
}

export async function deleteProgression(athleteId: string, progressionId: string): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("progressions")
    .doc(progressionId)
    .delete();
}

// =============================================================================
// TRAINING PLANS CRUD
// =============================================================================

export async function getTrainingPlans(athleteId: string): Promise<{ id: string; data: FirestoreTrainingPlan }[]> {
  const snapshot = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("training_plans")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreTrainingPlan,
  }));
}

export async function createTrainingPlan(athleteId: string, data: FirestoreTrainingPlan): Promise<{ id: string; data: FirestoreTrainingPlan }> {
  const docRef = await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("training_plans")
    .add(data);
  return { id: docRef.id, data };
}

export async function updateTrainingPlan(athleteId: string, planId: string, data: Partial<FirestoreTrainingPlan>): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("training_plans")
    .doc(planId)
    .update(data);
}

export async function deleteTrainingPlan(athleteId: string, planId: string): Promise<void> {
  await getDb()
    .collection(ATHLETES)
    .doc(athleteId)
    .collection("training_plans")
    .doc(planId)
    .delete();
}
