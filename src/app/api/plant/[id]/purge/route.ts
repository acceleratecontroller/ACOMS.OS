import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// POST /api/plant/[id]/purge — Permanently delete a plant item
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Fetch the plant first so we can log it
  const plant = await prisma.plant.findUnique({ where: { id } });
  if (!plant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove all asset links for this plant first
  const { error: unlinkError } = await withPrismaError("Failed to unlink assets", () =>
    prisma.plantAssetLink.deleteMany({ where: { plantId: id } })
  );
  if (unlinkError) return unlinkError;

  // Permanently delete the plant record
  const { error } = await withPrismaError("Failed to delete plant", () =>
    prisma.plant.delete({ where: { id } })
  );
  if (error) return error;

  // Log the permanent deletion — the audit entry persists even though the plant is gone
  audit({
    entityType: "Plant",
    entityId: id,
    action: "DELETE",
    entityLabel: `${plant.plantNumber}`,
    performedById: session.user.id,
  });

  return NextResponse.json({ success: true });
}
