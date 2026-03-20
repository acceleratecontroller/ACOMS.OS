import { TOTP, Secret } from "otpauth";

const ISSUER = "ACOMS.OS";
const PERIOD = 30; // seconds
const DIGITS = 6;
const ALGORITHM = "SHA1"; // Most compatible with authenticator apps

/**
 * Generate a new random TOTP secret (base32 encoded).
 */
export function generateTotpSecret(): string {
  const secret = new Secret({ size: 20 });
  return secret.base32;
}

/**
 * Build a TOTP instance from a base32 secret.
 */
function buildTotp(secret: string, userEmail: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secret),
  });
}

/**
 * Generate the otpauth:// URI for QR code scanning.
 */
export function getTotpUri(secret: string, userEmail: string): string {
  return buildTotp(secret, userEmail).toString();
}

/**
 * Verify a TOTP code. Allows ±1 time step (30s window) for clock drift.
 * Returns true if valid.
 */
export function verifyTotpCode(secret: string, code: string, userEmail: string): boolean {
  const totp = buildTotp(secret, userEmail);
  // delta returns null if invalid, or the time step difference
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
