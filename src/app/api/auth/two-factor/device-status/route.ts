import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/shared/auth/auth";
import { verifyDeviceToken, daysUntil } from "@/shared/auth/trusted-device";

const TRUST_COOKIE_NAME = "acoms_trusted_device";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ trusted: false });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TRUST_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ trusted: false });
  }

  const device = await verifyDeviceToken(token, session.user.id);
  if (!device) {
    return NextResponse.json({ trusted: false });
  }

  return NextResponse.json({
    trusted: true,
    daysRemaining: daysUntil(device.expiresAt),
  });
}
