import { randomBytes } from "crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "@/shared/database/client";

const CODE_COUNT = 10;
const CODE_LENGTH = 8; // 8-character alphanumeric codes

/**
 * Generate a set of random backup codes (plaintext).
 * Returns an array of human-readable codes like "A1B2-C3D4".
 */
function generatePlaintextCodes(): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I to avoid confusion
  for (let i = 0; i < CODE_COUNT; i++) {
    const bytes = randomBytes(CODE_LENGTH);
    let code = "";
    for (let j = 0; j < CODE_LENGTH; j++) {
      code += chars[bytes[j] % chars.length];
    }
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Generate backup codes for a user, store hashes in DB, return plaintext codes.
 * Deletes any existing backup codes for the user first.
 */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const plaintextCodes = generatePlaintextCodes();

  // Hash all codes
  const hashedCodes = await Promise.all(
    plaintextCodes.map(async (code) => ({
      userId,
      codeHash: await hash(code, 10),
    }))
  );

  // Delete old codes and insert new ones in a transaction
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({ data: hashedCodes }),
  ]);

  return plaintextCodes;
}

/**
 * Verify a backup code for a user. If valid, marks it as used.
 * Returns true if a matching unused code was found and consumed.
 */
export async function verifyBackupCode(userId: string, inputCode: string): Promise<boolean> {
  // Normalise: uppercase, trim whitespace, allow with or without dash
  const normalised = inputCode.toUpperCase().replace(/\s/g, "");
  const formatted = normalised.includes("-")
    ? normalised
    : `${normalised.slice(0, 4)}-${normalised.slice(4)}`;

  const unusedCodes = await prisma.backupCode.findMany({
    where: { userId, used: false },
  });

  for (const record of unusedCodes) {
    const isMatch = await compare(formatted, record.codeHash);
    if (isMatch) {
      await prisma.backupCode.update({
        where: { id: record.id },
        data: { used: true },
      });
      return true;
    }
  }

  return false;
}
