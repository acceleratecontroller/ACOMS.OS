// src/shared/auth/service-token.ts
// Validates service tokens from external portals (Controller, WIP)

import { createHash } from "crypto";

export function validateServiceToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const expectedToken = process.env.ACOMS_OS_SERVICE_TOKEN;

  if (!expectedToken) return false;

  // Constant-time comparison via hash
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expectedHash = createHash("sha256").update(expectedToken).digest("hex");

  return tokenHash === expectedHash;
}
