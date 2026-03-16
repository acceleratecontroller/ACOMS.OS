import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createAssetSchema } from "@/modules/assets/validation";
import { auth } from "@/shared/auth/auth";

// GET /api/assets — List all active (non-archived) assets
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const assets = await prisma.asset.findMany({
    where: { isArchived: showArchived },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assets);
}

// POST /api/assets — Create a new asset
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const asset = await prisma.asset.create({
    data: {
      assetNumber: data.assetNumber,
      name: data.name,
      category: data.category,
      make: data.make || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost) : null,
      location: data.location || null,
      assignedToId: data.assignedToId || null,
      status: data.status,
      condition: data.condition || null,
      notes: data.notes || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
