import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

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

  // Check current status so we can reset RETIRED → AVAILABLE on restore
  const current = await prisma.asset.findUnique({ where: { id }, select: { status: true } });

  const { result: asset, error } = await withPrismaError("Failed to restore asset", () =>
    prisma.asset.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        ...(current?.status === "RETIRED" && { status: "AVAILABLE" }),
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "RESTORE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(asset);
}
