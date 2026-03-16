import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateAssetSchema } from "@/modules/assets/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";

// GET /api/assets/[id] — Get a single asset
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(asset);
}

// PUT /api/assets/[id] — Update an asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const before = await prisma.asset.findUnique({ where: { id } });

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...(data.assetNumber !== undefined && { assetNumber: data.assetNumber }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.make !== undefined && { make: data.make || null }),
      ...(data.model !== undefined && { model: data.model || null }),
      ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber || null }),
      ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
      ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost) : null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.condition !== undefined && { condition: data.condition || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  const changes = before ? diff(before as unknown as Record<string, unknown>, asset as unknown as Record<string, unknown>) : null;

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "UPDATE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.id,
    changes,
  });

  return NextResponse.json(asset);
}

// DELETE /api/assets/[id] — Soft-delete (archive) an asset
export async function DELETE(
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
      isArchived: true,
      archivedAt: new Date(),
      archivedById: session.user.id,
    },
  });

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "ARCHIVE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(asset);
}
