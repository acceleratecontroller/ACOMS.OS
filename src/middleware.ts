// src/middleware.ts — Simplified: no more 2FA logic, login pages, or TwoFactorGuard

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ADMIN_ONLY_ROUTES = ["/tasks", "/activity-log"];
const ADMIN_ONLY_API_ROUTES = ["/api/tasks", "/api/recurring-tasks", "/api/activity-log"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes and static files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    // No session → redirect to NextAuth sign-in page for acoms-auth provider
    const signInUrl = new URL("/api/auth/signin/acoms-auth", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
