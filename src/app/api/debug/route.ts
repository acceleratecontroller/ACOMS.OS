import { NextResponse } from "next/server";

// Temporary debug endpoint — DELETE after resolving auth issue
export async function GET() {
  const url = process.env.ACOMS_AUTH_URL;
  const results: Record<string, unknown> = {
    ACOMS_AUTH_URL: url,
    ACOMS_AUTH_CLIENT_ID: process.env.ACOMS_AUTH_CLIENT_ID,
    HAS_CLIENT_SECRET: !!process.env.ACOMS_AUTH_CLIENT_SECRET,
    HAS_AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
  };

  // Try fetching OIDC discovery
  try {
    const discoveryUrl = `${url}/.well-known/openid-configuration`;
    results.discoveryUrl = discoveryUrl;
    const res = await fetch(discoveryUrl);
    results.discoveryStatus = res.status;
    results.discoveryHeaders = Object.fromEntries(res.headers.entries());
    if (res.ok) {
      results.discoveryBody = await res.json();
    } else {
      results.discoveryBody = await res.text();
    }
  } catch (err) {
    results.discoveryError = String(err);
  }

  return NextResponse.json(results, { status: 200 });
}
