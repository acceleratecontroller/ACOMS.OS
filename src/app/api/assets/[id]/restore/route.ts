import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// POST /api/assets/[id]/restore — Restore an archived asset
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      isArchived: false,
      archivedAt: null,
      archivedById: null,
    },
  });

  return NextResponse.json(asset);
}
