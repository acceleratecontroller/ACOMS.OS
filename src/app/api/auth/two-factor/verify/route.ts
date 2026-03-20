import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { verifyTotpCode } from "@/shared/auth/totp";
import { decrypt } from "@/shared/auth/encryption";
import { verifyBackupCode } from "@/shared/auth/backup-codes";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "@/shared/auth/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const rateLimitKey = `2fa-verify:${session.user.id}`;
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000);
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = body?.code as string | undefined;
  const isBackupCode = body?.isBackupCode as boolean | undefined;

  if (!code) {
    return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled" }, { status: 400 });
  }

  let isValid = false;

  if (isBackupCode) {
    isValid = await verifyBackupCode(session.user.id, code);
  } else {
    const secret = decrypt(user.twoFactorSecret);
    isValid = verifyTotpCode(secret, code, user.email);
  }

  if (!isValid) {
    const locked = recordFailedAttempt(rateLimitKey);
    const message = locked
      ? "Too many failed attempts. Your account has been temporarily locked."
      : "Invalid verification code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Success — clear rate limit and persist verification in DB
  clearAttempts(rateLimitKey);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorVerifiedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
