import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";

// =============================================================================
// TYPES
// =============================================================================

export interface FirestoreAthlete {
  id: string;
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
  id: string;
  athleteId: string;
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
  id: string;
  athleteId: string;
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
  id: string;
  athleteId: string;
  exerciseName: string;
  weightKg: number;
  reps?: string | null;
  sets?: string | null;
  note?: string | null;
  source: string;
  createdAt: string;
}

export interface FirestoreTrainingPlan {
  id: string;
  athleteId: string;
  planName: string;
  phase?: string | null;
  planJson: DocumentData;
  createdAt: string;
}

// =============================================================================
// ATHLETES
// =============================================================================

const ATHLETES_COLLECTION = "athletes";

export async function getAthletes(coachId: string): Promise<FirestoreAthlete[]> {
  const q = query(
    collection(db, ATHLETES_COLLECTION),
    where("coachId", "==", coachId),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as FirestoreAthlete[];
}

export async function getAthlete(id: string): Promise<FirestoreAthlete | null> {
  const snapshot = await getDocs(query(collection(db, ATHLETES_COLLECTION), where("__name__", "==", id)));
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FirestoreAthlete;
}

export async function createAthlete(data: Omit<FirestoreAthlete, "id">): Promise<FirestoreAthlete> {
  const docRef = await addDoc(collection(db, ATHLETES_COLLECTION), data);
  return { id: docRef.id, ...data };
}

export async function updateAthlete(id: string, data: Partial<FirestoreAthlete>): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, id);
  await updateDoc(docRef, data);
}

export async function deleteAthlete(id: string): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, id);
  await deleteDoc(docRef);
}

// =============================================================================
// INJURIES
// =============================================================================

export async function getInjuries(athleteId: string): Promise<FirestoreInjury[]> {
  const q = query(
    collection(db, ATHLETES_COLLECTION, athleteId, "injuries"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    athleteId,
    ...doc.data(),
  })) as FirestoreInjury[];
}

export async function createInjury(athleteId: string, data: Omit<FirestoreInjury, "id" | "athleteId">): Promise<FirestoreInjury> {
  const docRef = await addDoc(collection(db, ATHLETES_COLLECTION, athleteId, "injuries"), data);
  return { id: docRef.id, athleteId, ...data };
}

export async function updateInjury(athleteId: string, injuryId: string, data: Partial<FirestoreInjury>): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "injuries", injuryId);
  await updateDoc(docRef, data);
}

export async function deleteInjury(athleteId: string, injuryId: string): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "injuries", injuryId);
  await deleteDoc(docRef);
}

// =============================================================================
// FMS DIAGNOSTICS
// =============================================================================

export async function getFmsDiagnostics(athleteId: string): Promise<FirestoreFmsDiagnostic[]> {
  const q = query(
    collection(db, ATHLETES_COLLECTION, athleteId, "fms_diagnostics"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    athleteId,
    ...doc.data(),
  })) as FirestoreFmsDiagnostic[];
}

export async function createFmsDiagnostic(athleteId: string, data: Omit<FirestoreFmsDiagnostic, "id" | "athleteId">): Promise<FirestoreFmsDiagnostic> {
  const docRef = await addDoc(collection(db, ATHLETES_COLLECTION, athleteId, "fms_diagnostics"), data);
  return { id: docRef.id, athleteId, ...data };
}

export async function updateFmsDiagnostic(athleteId: string, diagnosticId: string, data: Partial<FirestoreFmsDiagnostic>): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "fms_diagnostics", diagnosticId);
  await updateDoc(docRef, data);
}

export async function deleteFmsDiagnostic(athleteId: string, diagnosticId: string): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "fms_diagnostics", diagnosticId);
  await deleteDoc(docRef);
}

// =============================================================================
// PROGRESSIONS
// =============================================================================

export async function getProgressions(athleteId: string): Promise<FirestoreProgression[]> {
  const q = query(
    collection(db, ATHLETES_COLLECTION, athleteId, "progressions"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    athleteId,
    ...doc.data(),
  })) as FirestoreProgression[];
}

export async function createProgression(athleteId: string, data: Omit<FirestoreProgression, "id" | "athleteId">): Promise<FirestoreProgression> {
  const docRef = await addDoc(collection(db, ATHLETES_COLLECTION, athleteId, "progressions"), data);
  return { id: docRef.id, athleteId, ...data };
}

export async function updateProgression(athleteId: string, progressionId: string, data: Partial<FirestoreProgression>): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "progressions", progressionId);
  await updateDoc(docRef, data);
}

export async function deleteProgression(athleteId: string, progressionId: string): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "progressions", progressionId);
  await deleteDoc(docRef);
}

// =============================================================================
// TRAINING PLANS
// =============================================================================

export async function getTrainingPlans(athleteId: string): Promise<FirestoreTrainingPlan[]> {
  const q = query(
    collection(db, ATHLETES_COLLECTION, athleteId, "training_plans"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    athleteId,
    ...doc.data(),
  })) as FirestoreTrainingPlan[];
}

export async function createTrainingPlan(athleteId: string, data: Omit<FirestoreTrainingPlan, "id" | "athleteId">): Promise<FirestoreTrainingPlan> {
  const docRef = await addDoc(collection(db, ATHLETES_COLLECTION, athleteId, "training_plans"), data);
  return { id: docRef.id, athleteId, ...data };
}

export async function updateTrainingPlan(athleteId: string, planId: string, data: Partial<FirestoreTrainingPlan>): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "training_plans", planId);
  await updateDoc(docRef, data);
}

export async function deleteTrainingPlan(athleteId: string, planId: string): Promise<void> {
  const docRef = doc(db, ATHLETES_COLLECTION, athleteId, "training_plans", planId);
  await deleteDoc(docRef);
}

// =============================================================================
// REALTIME SUBSCRIPTIONS
// =============================================================================

export function subscribeToAthletes(
  coachId: string,
  callback: (athletes: FirestoreAthlete[]) => void
): () => void {
  const q = query(
    collection(db, ATHLETES_COLLECTION),
    where("coachId", "==", coachId),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const athletes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirestoreAthlete[];
    callback(athletes);
  });
}

export function subscribeToInjuries(
  athleteId: string,
  callback: (injuries: FirestoreInjury[]) => void
): () => void {
  const q = query(
    collection(db, ATHLETES_COLLECTION, athleteId, "injuries"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const injuries = snapshot.docs.map((doc) => ({
      id: doc.id,
      athleteId,
      ...doc.data(),
    })) as FirestoreInjury[];
    callback(injuries);
  });
}
