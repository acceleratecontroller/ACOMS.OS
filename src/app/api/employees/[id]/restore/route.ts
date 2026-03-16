import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// POST /api/employees/[id]/restore — Restore an archived employee
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      isArchived: false,
      archivedAt: null,
      archivedById: null,
    },
  });

  return NextResponse.json(employee);
}
