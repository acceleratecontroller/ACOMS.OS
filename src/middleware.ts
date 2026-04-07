// src/middleware.ts — Simplified: no more 2FA logic, login pages, or TwoFactorGuard

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ADMIN_ONLY_ROUTES = ["/tasks", "/activity-log"];
const ADMIN_ONLY_API_ROUTES = ["/api/activity-log"];

// Staff portal API routes — only accessible by the logged-in staff member (enforced in route handlers)
const STAFF_API_ROUTES = ["/api/staff"];

// Service-token authenticated API routes — these handle their own auth via service tokens
// and should not require a session cookie
const SERVICE_TOKEN_ROUTES = ["/api/employees/assignees", "/api/employees/lookup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes and static files
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Allow service-token authenticated routes (they validate their own auth)
  if (SERVICE_TOKEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie) {
    // No session → redirect to login page (triggers OIDC flow server-side)
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
