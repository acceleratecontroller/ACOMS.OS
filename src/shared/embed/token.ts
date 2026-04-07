// src/shared/embed/token.ts — Generates signed embed tokens for cross-origin iframe authentication.
// ACOMS.OS signs these tokens; ACOMS.Controller validates them.
// Uses ACOMS_OS_SERVICE_TOKEN as the shared HMAC secret.

import { createHmac } from "crypto";

interface EmbedTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  identityId: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.ACOMS_OS_SERVICE_TOKEN;
  if (!secret) throw new Error("ACOMS_OS_SERVICE_TOKEN is not configured");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Generate a signed embed token for the given user.
 * Default TTL is 5 minutes (the iframe will auto-refresh before expiry).
 */
export function generateEmbedToken(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  identityId: string;
}, ttlMs = 5 * 60 * 1000): string {
  const payload: EmbedTokenPayload = {
    sub: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role,
    identityId: user.identityId,
    exp: Date.now() + ttlMs,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}
