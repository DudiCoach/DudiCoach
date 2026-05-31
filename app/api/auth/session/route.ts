import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "firebase-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

/**
 * POST /api/auth/session
 * Exchanges a Firebase ID token for a session cookie.
 * Client calls this after successful Firebase Auth sign-in.
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 },
      );
    }

    getFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(idToken);

    // Only allow allowed coach emails
    if (!decoded.email) {
      return NextResponse.json(
        { error: "Email not available" },
        { status: 403 },
      );
    }

    const sessionCookie = await getAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE * 1000,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/auth/session] error", error);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clears the session cookie (logout).
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ success: true });
}
