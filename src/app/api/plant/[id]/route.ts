import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updatePlantSchema } from "@/modules/plant/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, validateEmployeeRef, withPrismaError } from "@/shared/api/helpers";

// GET /api/plant/[id] — Get a single plant item (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: plant, error } = await withPrismaError("Failed to get plant", () =>
    prisma.plant.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        assetLinks: {
          where: { unlinkedAt: null },
          include: {
            asset: {
              select: { id: true, assetNumber: true, name: true, category: true, status: true, condition: true },
            },
          },
          orderBy: { linkedAt: "desc" },
        },
      },
    }),
  );
  if (error) return error;

  if (!plant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(plant);
}

// PUT /api/plant/[id] — Update a plant item
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

  const parsed = updatePlantSchema.safeParse(body);

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

  // Check for duplicate registration number (if being changed)
  if (data.registrationNumber) {
    const existingRego = await prisma.plant.findFirst({
      where: { registrationNumber: data.registrationNumber, id: { not: id } },
    });
    if (existingRego) {
      return NextResponse.json(
        { error: `A plant with registration number "${data.registrationNumber}" already exists (${existingRego.plantNumber}).` },
        { status: 409 },
      );
    }
  }

  // Check for duplicate VIN number (if being changed)
  if (data.vinNumber) {
    const existingVin = await prisma.plant.findFirst({
      where: { vinNumber: data.vinNumber, id: { not: id } },
    });
    if (existingVin) {
      return NextResponse.json(
        { error: `A plant with VIN "${data.vinNumber}" already exists (${existingVin.plantNumber}).` },
        { status: 409 },
      );
    }
  }

  const before = await prisma.plant.findUnique({ where: { id } });

  const { result: plant, error } = await withPrismaError("Failed to update plant", () =>
    prisma.plant.update({
      where: { id },
      data: {
        ...(data.category !== undefined && { category: data.category }),
        ...(data.stateRegistered !== undefined && { stateRegistered: data.stateRegistered || null }),
        ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber || null }),
        ...(data.vinNumber !== undefined && { vinNumber: data.vinNumber || null }),
        ...(data.year !== undefined && { year: data.year ?? null }),
        ...(data.make !== undefined && { make: data.make || null }),
        ...(data.model !== undefined && { model: data.model || null }),
        ...(data.licenceType !== undefined && { licenceType: data.licenceType || null }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
        ...(data.ampolCardNumber !== undefined && { ampolCardNumber: data.ampolCardNumber || null }),
        ...(data.ampolCardExpiry !== undefined && { ampolCardExpiry: data.ampolCardExpiry ? new Date(data.ampolCardExpiry) : null }),
        ...(data.linktTagNumber !== undefined && { linktTagNumber: data.linktTagNumber || null }),
        ...(data.fleetDynamicsSerialNumber !== undefined && { fleetDynamicsSerialNumber: data.fleetDynamicsSerialNumber || null }),
        ...(data.coiExpirationDate !== undefined && { coiExpirationDate: data.coiExpirationDate ? new Date(data.coiExpirationDate) : null }),
        ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice ?? null }),
        ...(data.soldDate !== undefined && { soldDate: data.soldDate ? new Date(data.soldDate) : null }),
        ...(data.soldPrice !== undefined && { soldPrice: data.soldPrice ?? null }),
        ...(data.comments !== undefined && { comments: data.comments || null }),
        ...(data.lastServiceDate !== undefined && { lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null }),
        ...(data.nextServiceDue !== undefined && { nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue) : null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.condition !== undefined && { condition: data.condition || null }),
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, plant as unknown as Record<string, unknown>) : null;

  audit({
    entityType: "Plant",
    entityId: plant.id,
    action: "UPDATE",
    entityLabel: `${plant.plantNumber}`,
    performedById: session.user.identityId,
    changes,
  });

  return NextResponse.json(plant);
}

// DELETE /api/plant/[id] — Soft-delete (archive) a plant item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { result: plant, error } = await withPrismaError("Failed to archive plant", () =>
    prisma.plant.update({
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
    entityType: "Plant",
    entityId: plant.id,
    action: "ARCHIVE",
    entityLabel: `${plant.plantNumber}`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(plant);
}
