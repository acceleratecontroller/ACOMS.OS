import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/plant/[id]/assets — List active linked assets for a plant item
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { result: links, error } = await withPrismaError("Failed to list linked assets", () =>
    prisma.plantAssetLink.findMany({
      where: { plantId: id, unlinkedAt: null },
      include: {
        asset: {
          select: {
            id: true,
            assetNumber: true,
            name: true,
            category: true,
            status: true,
            condition: true,
          },
        },
      },
      orderBy: { linkedAt: "desc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(links);
}

// POST /api/plant/[id]/assets — Link an existing asset or create-and-link a new one
// Body: { assetId: string, notes?: string }  — link existing
//   OR  { create: { assetNumber, name, category, status, ... }, notes?: string } — create + link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: plantId } = await params;
  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  // Verify plant exists
  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    select: { id: true, name: true, plantNumber: true, isArchived: true },
  });
  if (!plant) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }
  if (plant.isArchived) {
    return NextResponse.json({ error: "Cannot link assets to an archived plant item" }, { status: 400 });
  }

  const notes = (body as Record<string, unknown>).notes as string | undefined;

  // Path 1: Link existing asset
  if ((body as Record<string, unknown>).assetId) {
    const assetId = (body as Record<string, unknown>).assetId as string;

    // Verify asset exists and is not archived
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, name: true, assetNumber: true, isArchived: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (asset.isArchived) {
      return NextResponse.json({ error: "Cannot link an archived asset" }, { status: 400 });
    }

    // Check not already linked to this plant
    const existing = await prisma.plantAssetLink.findFirst({
      where: { plantId, assetId, unlinkedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "This asset is already linked to this plant item" }, { status: 409 });
    }

    const { result: link, error } = await withPrismaError("Failed to link asset", () =>
      prisma.plantAssetLink.create({
        data: { plantId, assetId, notes: notes || null },
        include: {
          asset: {
            select: { id: true, assetNumber: true, name: true, category: true, status: true, condition: true },
          },
        },
      }),
    );
    if (error) return error;

    audit({
      entityType: "Plant",
      entityId: plantId,
      action: "UPDATE",
      entityLabel: `${plant.name} (${plant.plantNumber})`,
      performedById: session.user.id,
      changes: { linkedAsset: { from: null, to: `${asset.name} (${asset.assetNumber})` } },
    });

    return NextResponse.json(link, { status: 201 });
  }

  // Path 2: Create new asset and link
  if ((body as Record<string, unknown>).create) {
    const createData = (body as Record<string, unknown>).create as Record<string, unknown>;

    if (!createData.name || !createData.category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 },
      );
    }

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

    const { result, error } = await withPrismaError("Failed to create and link asset", () =>
      prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
          data: {
            assetNumber,
            name: createData.name as string,
            category: createData.category as string,
            make: (createData.make as string) || null,
            model: (createData.model as string) || null,
            serialNumber: (createData.serialNumber as string) || null,
            status: (createData.status as "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "RETIRED") || "IN_USE",
            condition: (createData.condition as "NEW" | "GOOD" | "FAIR" | "POOR") || null,
            location: (createData.location as string) || null,
            notes: (createData.notes as string) || null,
            createdById: session.user.id,
          },
        });

        const link = await tx.plantAssetLink.create({
          data: { plantId, assetId: asset.id, notes: notes || null },
          include: {
            asset: {
              select: { id: true, assetNumber: true, name: true, category: true, status: true, condition: true },
            },
          },
        });

        return { asset, link };
      }),
    );
    if (error) return error;

    audit({
      entityType: "Asset",
      entityId: result.asset.id,
      action: "CREATE",
      entityLabel: `${result.asset.name} (${result.asset.assetNumber})`,
      performedById: session.user.id,
    });

    audit({
      entityType: "Plant",
      entityId: plantId,
      action: "UPDATE",
      entityLabel: `${plant.name} (${plant.plantNumber})`,
      performedById: session.user.id,
      changes: { linkedAsset: { from: null, to: `${result.asset.name} (${result.asset.assetNumber})` } },
    });

    return NextResponse.json(result.link, { status: 201 });
  }

  return NextResponse.json(
    { error: "Provide either assetId (to link existing) or create (to create and link)" },
    { status: 400 },
  );
}
