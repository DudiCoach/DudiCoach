"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/lib/firebase/auth";

export async function signOutAction(): Promise<void> {
  try {
    await signOut();
    // Clear the session cookie via API
    await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/session`,
      { method: "DELETE" },
    );
  } catch (err) {
    const e = err as Error;
    console.warn("[signOutAction] Error during sign-out", { name: e.name });
  }

  redirect("/login");
}
