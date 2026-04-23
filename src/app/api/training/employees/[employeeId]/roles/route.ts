import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";
import {
  accreditationIdsForRole,
  cleanupOrphanedPendingAndExempt,
  ensureEmployeeAccreditations,
} from "@/modules/training/requirements";

// GET /api/training/employees/[employeeId]/roles
// STAFF users can only view their own roles
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId } = await params;

  // STAFF can only view their own training roles
  if (session.user.role !== "ADMIN" && employeeId !== session.user.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { result, error } = await withPrismaError("Failed to list employee roles", () =>
    prisma.employeeRole.findMany({
      where: { employeeId },
      include: {
        role: {
          select: { id: true, roleNumber: true, name: true, category: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/training/employees/[employeeId]/roles — Assign a role + auto-assign accreditations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await params;
  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const roleId = (body as { roleId?: string }).roleId;
  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  // Assign the role
  const { result: employeeRole, error } = await withPrismaError("Failed to assign role", () =>
    prisma.employeeRole.create({
      data: { employeeId, roleId },
      include: {
        role: { select: { id: true, roleNumber: true, name: true, category: true } },
      },
    }),
  );
  if (error) return error;

  // Auto-assign accreditations: role → skills → accreditations
  const accrIds = await accreditationIdsForRole(roleId);
  await ensureEmployeeAccreditations([employeeId], accrIds);

  audit({
    entityType: "EmployeeRole",
    entityId: employeeRole.id,
    action: "CREATE",
    entityLabel: `${employeeRole.role.name} assigned to employee ${employeeId}`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(employeeRole, { status: 201 });
}

// DELETE /api/training/employees/[employeeId]/roles — Remove a role
// Also cleans up orphaned PENDING/EXEMPT accreditation rows that are no
// longer required. VERIFIED and EXPIRED rows are always preserved.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await params;
  const roleId = request.nextUrl.searchParams.get("roleId");
  if (!roleId) {
    return NextResponse.json({ error: "roleId query param is required" }, { status: 400 });
  }

  const { error } = await withPrismaError("Failed to remove role", () =>
    prisma.employeeRole.delete({
      where: { employeeId_roleId: { employeeId, roleId } },
    }),
  );
  if (error) return error;

  await cleanupOrphanedPendingAndExempt([employeeId]);

  return NextResponse.json({ success: true });
}
