import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const required = body?.required as boolean | undefined;

  if (!userId || typeof required !== "boolean") {
    return NextResponse.json({ error: "userId and required (boolean) are required" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorRequired: required },
  });

  return NextResponse.json({ success: true });
}

// Bulk: require 2FA for all users
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const required = body?.required as boolean | undefined;

  if (typeof required !== "boolean") {
    return NextResponse.json({ error: "required (boolean) is required" }, { status: 400 });
  }

  await prisma.user.updateMany({
    data: { twoFactorRequired: required },
  });

  return NextResponse.json({ success: true });
}
