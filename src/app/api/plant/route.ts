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

  // Auto-generate plant number: PLT-0001, PLT-0002, etc.
  const lastPlant = await prisma.plant.findFirst({
    orderBy: { plantNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastPlant) {
    const match = lastPlant.plantNumber.match(/PLT-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const plantNumber = `PLT-${String(nextNumber).padStart(4, "0")}`;

  const { result: plant, error } = await withPrismaError("Failed to create plant", () =>
    prisma.plant.create({
      data: {
        plantNumber,
        category: data.category,
        stateRegistered: data.stateRegistered || null,
        registrationNumber: data.registrationNumber || null,
        vinNumber: data.vinNumber || null,
        year: data.year ?? null,
        make: data.make || null,
        model: data.model || null,
        licenceType: data.licenceType || null,
        location: data.location || null,
        assignedToId: data.assignedToId || null,
        ampolCardNumber: data.ampolCardNumber || null,
        ampolCardExpiry: data.ampolCardExpiry ? new Date(data.ampolCardExpiry) : null,
        linktTagNumber: data.linktTagNumber || null,
        fleetDynamicsSerialNumber: data.fleetDynamicsSerialNumber || null,
        coiExpirationDate: data.coiExpirationDate ? new Date(data.coiExpirationDate) : null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice ?? null,
        soldDate: data.soldDate ? new Date(data.soldDate) : null,
        soldPrice: data.soldPrice ?? null,
        comments: data.comments || null,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
        nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue) : null,
        status: data.status,
        condition: data.condition || null,
        createdById: session.user.id,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Plant",
    entityId: plant.id,
    action: "CREATE",
    entityLabel: `${plant.plantNumber}`,
    performedById: session.user.id,
  });

  return NextResponse.json(plant, { status: 201 });
}
