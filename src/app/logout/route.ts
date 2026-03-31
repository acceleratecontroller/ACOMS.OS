import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();

  // Delete all auth session cookies
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.callback-url");
  cookieStore.delete("__Secure-authjs.callback-url");
  cookieStore.delete("authjs.csrf-token");
  cookieStore.delete("__Host-authjs.csrf-token");

  // Redirect to ACOMS.Auth logout to clear the SSO session too,
  // then come back to ACOMS.OS login
  const returnUrl = encodeURIComponent(`${process.env.NEXTAUTH_URL}/login`);
  return NextResponse.redirect(
    `${process.env.ACOMS_AUTH_URL}/api/auth/logout?returnTo=${returnUrl}`
  );
}
