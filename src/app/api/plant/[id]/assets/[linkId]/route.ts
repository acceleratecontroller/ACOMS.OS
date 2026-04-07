import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// DELETE /api/plant/[id]/assets/[linkId] — Unlink an asset from a plant item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: plantId, linkId } = await params;

  const link = await prisma.plantAssetLink.findFirst({
    where: { id: linkId, plantId, unlinkedAt: null },
    include: {
      asset: { select: { name: true, assetNumber: true } },
      plant: { select: { plantNumber: true } },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const { result: updated, error } = await withPrismaError("Failed to unlink asset", () =>
    prisma.plantAssetLink.update({
      where: { id: linkId },
      data: { unlinkedAt: new Date() },
    }),
  );
  if (error) return error;

  // Check if asset has any other active plant links — if not, clear location and assignedTo
  const otherLinks = await prisma.plantAssetLink.findFirst({
    where: { assetId: link.assetId, unlinkedAt: null },
  });
  if (!otherLinks) {
    await prisma.asset.update({
      where: { id: link.assetId },
      data: { assignedToId: null, location: null },
    });
  }

  audit({
    entityType: "Plant",
    entityId: plantId,
    action: "UPDATE",
    entityLabel: `${link.plant.plantNumber}`,
    performedById: session.user.identityId,
    changes: { unlinkedAsset: { from: `${link.asset.name} (${link.asset.assetNumber})`, to: null } },
  });

  return NextResponse.json(updated);
}
