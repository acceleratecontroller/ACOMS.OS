import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createPlantSchema } from "@/modules/plant/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, validateEmployeeRef, withPrismaError } from "@/shared/api/helpers";

// GET /api/plant — List all active (non-archived) plant items
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result: plant, error } = await withPrismaError("Failed to list plant", () =>
    prisma.plant.findMany({
      where: { isArchived: showArchived },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        assetLinks: {
          where: { unlinkedAt: null },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(plant);
}

// POST /api/plant — Create a new plant item
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createPlantSchema.safeParse(body);

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

  const { result: plant, error } = await withPrismaError("Failed to create plant", () =>
    prisma.plant.create({
      data: {
        plantNumber: data.plantNumber,
        name: data.name,
        category: data.category,
        make: data.make || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        yearOfManufacture: data.yearOfManufacture ?? null,
        registrationNumber: data.registrationNumber || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost ?? null,
        location: data.location || null,
        assignedToId: data.assignedToId || null,
        status: data.status,
        condition: data.condition || null,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
        nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue) : null,
        notes: data.notes || null,
        createdById: session.user.id,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Plant",
    entityId: plant.id,
    action: "CREATE",
    entityLabel: `${plant.name} (${plant.plantNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(plant, { status: 201 });
}
