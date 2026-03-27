import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

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

  const { result: employee, error } = await withPrismaError("Failed to restore employee", () =>
    prisma.employee.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Employee",
    entityId: employee.id,
    action: "RESTORE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(employee);
}
