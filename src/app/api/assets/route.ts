import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createAssetSchema } from "@/modules/assets/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, validateEmployeeRef, withPrismaError } from "@/shared/api/helpers";

// GET /api/assets — List all active (non-archived) assets (admin only)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result: assets, error } = await withPrismaError("Failed to list assets", () =>
    prisma.asset.findMany({
      where: { isArchived: showArchived },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        plantLinks: {
          where: { unlinkedAt: null },
          include: { plant: { select: { id: true, plantNumber: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(assets);
}

// POST /api/assets — Create a new asset
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate assignedToId references an existing employee
  const refError = await validateEmployeeRef(data.assignedToId || null, "assignedToId");
  if (refError) return refError;

  // Auto-generate asset number: AST-0001, AST-0002, etc.
  const lastAsset = await prisma.asset.findFirst({
    orderBy: { assetNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastAsset) {
    const match = lastAsset.assetNumber.match(/AST-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const assetNumber = `AST-${String(nextNumber).padStart(4, "0")}`;

  const { result: asset, error } = await withPrismaError("Failed to create asset", () =>
    prisma.asset.create({
      data: {
        assetNumber,
        name: data.name,
        category: data.category,
        make: data.make || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost ?? null,
        location: data.location || null,
        assignedToId: data.assignedToId || null,
        status: data.status,
        condition: data.condition || null,
        notes: data.notes || null,
        createdById: session.user.identityId,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Asset",
    entityId: asset.id,
    action: "CREATE",
    entityLabel: `${asset.name} (${asset.assetNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(asset, { status: 201 });
}
