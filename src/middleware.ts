import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow access to login page, auth API, and static files
  if (
    pathname === "/login" ||
    pathname === "/login/verify" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Decode the JWT to check auth and 2FA state
  const token = await getToken({ req: request });

  // No session = not logged in
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If 2FA is enabled but not yet verified, redirect to verification page
  if (token.twoFactorEnabled && !token.twoFactorVerified) {
    return NextResponse.redirect(new URL("/login/verify", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
