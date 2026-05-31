import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const UNAUTHORIZED_ERROR_MESSAGE = "Brak autoryzacji.";

const SESSION_COOKIE_NAME = "firebase-session";

/** Simplified user type returned by requireAuth. */
export interface AuthUser {
  uid: string;
  email: string | null;
}

function unauthorizedResponse() {
  return NextResponse.json(
    { error: UNAUTHORIZED_ERROR_MESSAGE },
    { status: 401 },
  );
}

/**
 * Central auth guard for protected Route Handlers.
 * Reads the Firebase session cookie, verifies it, and returns the user.
 * Returns JSON 401 when the session is missing or invalid.
 */
export async function requireAuth(
  routeLabel: string,
): Promise<{ user: AuthUser; response: null } | { user: null; response: NextResponse }> {
  try {
    getFirebaseAdmin();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return { user: null, response: unauthorizedResponse() };
    }

    const decoded = await getAuth().verifySessionCookie(sessionCookie, true);

    return {
      user: { uid: decoded.uid, email: decoded.email ?? null },
      response: null,
    };
  } catch (error) {
    console.error(`[${routeLabel}] session verification failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return { user: null, response: unauthorizedResponse() };
  }
}
