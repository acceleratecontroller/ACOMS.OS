// GET /api/staff/plant — Returns plant assigned to the current staff member
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plant = await prisma.plant.findMany({
    where: {
      assignedToId: session.user.employeeId,
      isArchived: false,
    },
    select: {
      id: true,
      plantNumber: true,
      category: true,
      registrationNumber: true,
      make: true,
      model: true,
      year: true,
      location: true,
      status: true,
      condition: true,
      nextServiceDue: true,
      lastServiceDate: true,
    },
    orderBy: { plantNumber: "asc" },
  });

  return NextResponse.json(plant);
}
