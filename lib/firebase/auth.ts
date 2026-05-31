"use client";

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "./config";

/**
 * Allowed coach emails for Google login.
 * Only emails in this list can access the coach panel.
 */
const ALLOWED_COACH_EMAILS = [
  "dawid.malicki@peaklab.com.pl",
  "coach@example.com", // Test account
];

export function isAllowedCoachEmail(email: string | null): boolean {
  if (!email) return false;
  return ALLOWED_COACH_EMAILS.includes(email.toLowerCase());
}

export async function signInWithGoogle() {
  try {
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (!isAllowedCoachEmail(user.email)) {
      await firebaseSignOut(auth);
      return {
        user: null,
        error: "Ten adres email nie jest upoważniony do logowania.",
      };
    }

    return { user, error: null };
  } catch (error) {
    const e = error as { code?: string; message?: string };
    console.error("[signInWithGoogle] Error", {
      code: e.code,
      message: e.message,
    });
    return { user: null, error: e.message ?? "Failed to sign in with Google" };
  }
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  try {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error) {
    const e = error as { message?: string };
    console.error("[signOut] Error", { message: e.message });
    return { error: e.message ?? "Failed to sign out" };
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}
