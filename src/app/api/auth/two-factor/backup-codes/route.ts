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
    select: { twoFactorEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled" }, { status: 400 });
  }

  // Verify current TOTP code before regenerating
  const secret = decrypt(user.twoFactorSecret);
  const isValid = verifyTotpCode(secret, code, user.email);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  const backupCodes = await generateBackupCodes(session.user.id);

  return NextResponse.json({
    success: true,
    backupCodes,
    message: "New backup codes generated. Previous codes are no longer valid.",
  });
}
