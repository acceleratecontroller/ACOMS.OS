import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";

// POST /api/plant/[id]/restore — Restore an archived plant item
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const plant = await prisma.plant.update({
    where: { id },
    data: {
      isArchived: false,
      archivedAt: null,
      archivedById: null,
    },
  });

  audit({
    entityType: "Plant",
    entityId: plant.id,
    action: "RESTORE",
    entityLabel: `${plant.name} (${plant.plantNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(plant);
}
