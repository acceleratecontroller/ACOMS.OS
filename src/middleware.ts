import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

// Routes that STAFF users cannot access
const ADMIN_ONLY_ROUTES = ["/tasks", "/activity-log"];
const ADMIN_ONLY_API_ROUTES = ["/api/tasks", "/api/recurring-tasks", "/api/activity-log"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow access to login page, auth API, and static files
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for the NextAuth session token cookie
  const tokenCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  // No session token = not logged in, redirect to login
  if (!tokenCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Decode the JWT to check role for route-level access control
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    try {
      const token = await decode({
        token: tokenCookie.value,
        secret,
        salt: tokenCookie.name,
      });

      // If user has been revoked, clear cookies and redirect to login
      if (token?.isRevoked) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("authjs.session-token");
        response.cookies.delete("__Secure-authjs.session-token");
        return response;
      }

      if (token?.role && token.role !== "ADMIN") {
        // Check if STAFF user is trying to access admin-only page routes
        const isAdminOnlyPage = ADMIN_ONLY_ROUTES.some(
          (route) => pathname === route || pathname.startsWith(route + "/")
        );
        if (isAdminOnlyPage) {
          return NextResponse.redirect(new URL("/", request.url));
        }

        // Check if STAFF user is trying to access admin-only API routes
        const isAdminOnlyApi = ADMIN_ONLY_API_ROUTES.some(
          (route) => pathname === route || pathname.startsWith(route + "/")
        );
        if (isAdminOnlyApi) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    } catch {
      // If token decode fails, allow through — API routes will re-check auth
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
