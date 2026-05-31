import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "firebase-session";

const protectedPrefixes = ["/dashboard", "/athletes"];
const isProtectedRoute = (pathname: string) =>
  protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

/**
 * Next.js proxy — lightweight cookie-presence check.
 * Full session verification happens in lib/api/auth-guard.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  // Protect authenticated coach routes.
  if (isProtectedRoute(pathname) && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged-in user tries to access /login, redirect to dashboard.
  if (pathname === "/login" && sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/athletes/:path*",
    "/login",
  ],
};
