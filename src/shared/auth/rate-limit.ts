// Simple in-memory rate limiter for 2FA verification attempts.
// Tracks failed attempts per user and locks out after too many failures.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

/**
 * Check if a key (e.g. userId) is currently rate-limited.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const record = attempts.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil) {
    const now = Date.now();
    if (now < record.lockedUntil) {
      return { allowed: false, retryAfterMs: record.lockedUntil - now };
    }
    // Lockout expired — reset
    attempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a failed attempt. Returns true if now locked out.
 */
export function recordFailedAttempt(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    attempts.set(key, { count: 1, firstAttempt: now, lockedUntil: null });
    return false;
  }

  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    return true;
  }

  return false;
}

/**
 * Clear attempts for a key (e.g. after successful verification).
 */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}
