import { getDb } from "@/lib/firebase/admin";

export interface FirestoreFitnessTestResult {
  athleteId: string;
  testKey: string;
  testDate: string;
  value: number;
  unit?: string | null;
  notes?: string | null;
  createdAt: string;
}

const COLLECTION = "fitness_test_results";

export async function getFitnessTestResults(
  athleteId: string,
): Promise<{ id: string; data: FirestoreFitnessTestResult }[]> {
  const snapshot = await getDb()
    .collection(COLLECTION)
    .where("athleteId", "==", athleteId)
    .orderBy("testDate", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as FirestoreFitnessTestResult,
  }));
}

export async function createFitnessTestResult(
  data: FirestoreFitnessTestResult,
): Promise<{ id: string; data: FirestoreFitnessTestResult }> {
  const docRef = await getDb().collection(COLLECTION).add(data);
  return { id: docRef.id, data };
}

export async function deleteFitnessTestResult(
  athleteId: string,
  testId: string,
): Promise<boolean> {
  const doc = await getDb().collection(COLLECTION).doc(testId).get();
  if (!doc.exists || doc.data()?.athleteId !== athleteId) {
    return false;
  }
  await doc.ref.delete();
  return true;
}
