import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { generateTotpSecret, getTotpUri } from "@/shared/auth/totp";
import { encrypt } from "@/shared/auth/encryption";
import QRCode from "qrcode";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "Two-factor authentication is already enabled" }, { status: 400 });
  }

  // Generate a new secret and store it as pending
  const secret = generateTotpSecret();
  const encryptedSecret = encrypt(secret);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorSecret: encryptedSecret,
      twoFactorPending: true,
    },
  });

  // Generate QR code as data URL
  const uri = getTotpUri(secret, user.email);
  const qrCodeDataUrl = await QRCode.toDataURL(uri);

  return NextResponse.json({
    qrCode: qrCodeDataUrl,
    manualEntry: secret, // For users who can't scan QR codes
    uri,
  });
}
