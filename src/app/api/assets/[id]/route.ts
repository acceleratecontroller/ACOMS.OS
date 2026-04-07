import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateAssetSchema } from "@/modules/assets/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, validateEmployeeRef, withPrismaError } from "@/shared/api/helpers";

// GET /api/assets/[id] — Get a single asset (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: asset, error } = await withPrismaError("Failed to get asset", () =>
    prisma.asset.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        plantLinks: {
          where: { unlinkedAt: null },
          include: {
            plant: { select: { id: true, plantNumber: true } },
          },
        },
      },
    }),
  );
  if (error) return error;

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
  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = updateAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate assignedToId if provided
  if (data.assignedToId !== undefined) {
    const refError = await validateEmployeeRef(data.assignedToId || null, "assignedToId");
    if (refError) return refError;
  }

  const before = await prisma.asset.findUnique({ where: { id } });

  // Retiring an asset also archives it
  const isRetiring = data.status === "RETIRED";

  const { result: asset, error } = await withPrismaError("Failed to update asset", () =>
    prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.make !== undefined && { make: data.make || null }),
        ...(data.model !== undefined && { model: data.model || null }),
        ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber || null }),
        ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
        ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost ?? null }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.condition !== undefined && { condition: data.condition || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.expires !== undefined && {
          expires: data.expires ?? false,
          expirationDate: data.expires
            ? (data.expirationDate ? new Date(data.expirationDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
            : null,
        }),
        ...(isRetiring && { isArchived: true, archivedAt: new Date(), archivedById: session.user.identityId }),
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, asset as unknown as Record<string, unknown>) : null;

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "UPDATE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.identityId,
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

  // Check if asset is linked to any active plant items
  const activeLinks = await prisma.plantAssetLink.findMany({
    where: { assetId: id, unlinkedAt: null },
    include: { plant: { select: { plantNumber: true } } },
  });
  if (activeLinks.length > 0) {
    const plantNames = activeLinks.map((l) => l.plant.plantNumber).join(", ");
    return NextResponse.json(
      { error: `Cannot archive: this asset is linked to ${plantNames}. Unlink it first.` },
      { status: 400 },
    );
  }

  const { result: asset, error } = await withPrismaError("Failed to archive asset", () =>
    prisma.asset.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: session.user.identityId,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "ARCHIVE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(asset);
}
