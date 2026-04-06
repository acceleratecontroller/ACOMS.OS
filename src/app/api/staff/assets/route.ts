// GET /api/staff/assets — Returns assets assigned to the current staff member
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await prisma.asset.findMany({
    where: {
      assignedToId: session.user.employeeId,
      isArchived: false,
    },
    select: {
      id: true,
      assetNumber: true,
      name: true,
      category: true,
      make: true,
      model: true,
      serialNumber: true,
      status: true,
      condition: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(assets);
}
