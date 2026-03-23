import { randomBytes, createHash } from "crypto";
import { prisma } from "@/shared/database/client";

const TRUST_DURATION_DAYS = 30;

/** Generate a cryptographically random device trust token */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a device token for safe storage (SHA-256) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Store a trusted device record and return the raw token (to set as cookie) */
export async function trustDevice(userId: string, userAgent?: string): Promise<string> {
  const token = generateDeviceToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRUST_DURATION_DAYS);

  // Limit to 5 trusted devices per user — remove oldest if exceeded
  const existing = await prisma.trustedDevice.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length >= 5) {
    const toDelete = existing.slice(0, existing.length - 4);
    await prisma.trustedDevice.deleteMany({
      where: { id: { in: toDelete.map((d) => d.id) } },
    });
  }

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash,
      label: userAgent?.slice(0, 200) || null,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify a device trust token. Returns the device record if valid (not expired),
 * or null if invalid/expired. Expired tokens are cleaned up automatically.
 */
export async function verifyDeviceToken(
  token: string,
  userId: string
): Promise<{ expiresAt: Date } | null> {
  const tokenHash = hashToken(token);

  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash },
  });

  if (!device || device.userId !== userId) {
    return null;
  }

  if (device.expiresAt < new Date()) {
    // Expired — clean it up
    await prisma.trustedDevice.delete({ where: { id: device.id } }).catch(() => {});
    return null;
  }

  return { expiresAt: device.expiresAt };
}

/** Calculate days remaining until a date */
export function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Remove all trusted devices for a user (e.g. when 2FA is disabled/reset) */
export async function revokeAllDevices(userId: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { userId } });
}

/** Clean up expired trusted devices (can be called periodically) */
export async function cleanupExpiredDevices(): Promise<void> {
  await prisma.trustedDevice.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
