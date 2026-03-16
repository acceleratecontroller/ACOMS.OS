import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updatePlantSchema } from "@/modules/plant/validation";
import { auth } from "@/shared/auth/auth";

// GET /api/plant/[id] — Get a single plant item
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plant = await prisma.plant.findUnique({
    where: { id },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
  });

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
  const body = await request.json();
  const parsed = updatePlantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const plant = await prisma.plant.update({
    where: { id },
    data: {
      ...(data.plantNumber !== undefined && { plantNumber: data.plantNumber }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.make !== undefined && { make: data.make || null }),
      ...(data.model !== undefined && { model: data.model || null }),
      ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber || null }),
      ...(data.yearOfManufacture !== undefined && { yearOfManufacture: data.yearOfManufacture ? parseInt(data.yearOfManufacture) : null }),
      ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber || null }),
      ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
      ...(data.purchaseCost !== undefined && { purchaseCost: data.purchaseCost ? parseFloat(data.purchaseCost) : null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.condition !== undefined && { condition: data.condition || null }),
      ...(data.lastServiceDate !== undefined && { lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null }),
      ...(data.nextServiceDue !== undefined && { nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue) : null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
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

  const plant = await prisma.plant.update({
    where: { id },
    data: {
      isArchived: true,
      archivedAt: new Date(),
      archivedById: session.user.id,
    },
  });

  return NextResponse.json(plant);
}
