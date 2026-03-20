import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { verifyTotpCode } from "@/shared/auth/totp";
import { decrypt } from "@/shared/auth/encryption";
import { generateBackupCodes } from "@/shared/auth/backup-codes";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "A valid 6-digit code is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorPending: true, twoFactorEnabled: true, email: true },
  });

  if (!user || !user.twoFactorSecret || !user.twoFactorPending) {
    return NextResponse.json({ error: "No pending two-factor setup found. Start setup first." }, { status: 400 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "Two-factor authentication is already enabled" }, { status: 400 });
  }

  // Decrypt the secret and verify the code
  const secret = decrypt(user.twoFactorSecret);
  const isValid = verifyTotpCode(secret, code, user.email);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid verification code. Please try again." }, { status: 400 });
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorPending: false,
    },
  });

  // Generate backup codes
  const backupCodes = await generateBackupCodes(session.user.id);

  return NextResponse.json({
    success: true,
    backupCodes,
    message: "Two-factor authentication has been enabled. Save your backup codes securely.",
  });
}
