import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { compare } from "bcryptjs";
import { verifyTotpCode } from "@/shared/auth/totp";
import { decrypt } from "@/shared/auth/encryption";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password as string | undefined;
  const code = body?.code as string | undefined;

  if (!password || !code) {
    return NextResponse.json({ error: "Password and verification code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled" }, { status: 400 });
  }

  // Verify password
  const isPasswordValid = await compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json({ error: "Invalid password or verification code" }, { status: 400 });
  }

  // Verify TOTP code
  const secret = decrypt(user.twoFactorSecret);
  const isTotpValid = verifyTotpCode(secret, code, user.email);
  if (!isTotpValid) {
    return NextResponse.json({ error: "Invalid password or verification code" }, { status: 400 });
  }

  // Disable 2FA and clean up (including trusted devices)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPending: false,
        twoFactorVerifiedAt: null,
      },
    }),
    prisma.backupCode.deleteMany({ where: { userId: session.user.id } }),
    prisma.trustedDevice.deleteMany({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    success: true,
    message: "Two-factor authentication has been disabled.",
  });
}
