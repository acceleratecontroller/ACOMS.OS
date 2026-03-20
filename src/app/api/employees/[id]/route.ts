import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateEmployeeSchema } from "@/modules/employees/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/employees/[id] — Get a single employee
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: employee, error } = await withPrismaError("Failed to get employee", () =>
    prisma.employee.findUnique({
      where: { id },
      include: {
        trainingRoles: {
          include: { role: { select: { id: true, name: true, roleNumber: true } } },
        },
      },
    }),
  );
  if (error) return error;

  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

// PUT /api/employees/[id] — Update an employee
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

  const parsed = updateEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Auto-resolve status based on end date
  let status = data.status;
  if (data.endDate !== undefined) {
    if (data.endDate) {
      const end = new Date(data.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (end <= today) status = "TERMINATED";
    } else if (status === "TERMINATED") {
      // End date was cleared — revert status from TERMINATED to ACTIVE
      status = "ACTIVE";
    }
  }

  const before = await prisma.employee.findUnique({ where: { id } });

  const { result: employee, error } = await withPrismaError("Failed to update employee", () =>
    prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.personalEmail !== undefined && { personalEmail: data.personalEmail || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
        ...(data.shirtSize !== undefined && { shirtSize: data.shirtSize || null }),
        ...(data.pantsSize !== undefined && { pantsSize: data.pantsSize || null }),
        ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.probationDate !== undefined && { probationDate: data.probationDate ? new Date(data.probationDate) : null }),
        ...(status !== undefined && { status }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        // Emergency contact
        ...(data.emergencyFirstName !== undefined && { emergencyFirstName: data.emergencyFirstName || null }),
        ...(data.emergencyLastName !== undefined && { emergencyLastName: data.emergencyLastName || null }),
        ...(data.emergencyRelation !== undefined && { emergencyRelation: data.emergencyRelation || null }),
        ...(data.emergencyPhone !== undefined && { emergencyPhone: data.emergencyPhone || null }),
        ...(data.emergencyPhoneAlt !== undefined && { emergencyPhoneAlt: data.emergencyPhoneAlt || null }),
        // Sync training roles if provided
        ...(data.roleIds !== undefined && {
          trainingRoles: {
            deleteMany: {},
            create: data.roleIds.map((roleId: string) => ({ roleId })),
          },
        }),
      },
      include: {
        trainingRoles: {
          include: { role: { select: { id: true, name: true, roleNumber: true } } },
        },
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, employee as unknown as Record<string, unknown>) : null;

  audit({
    entityType: "Employee",
    entityId: employee.id,
    action: "UPDATE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
    changes,
  });

  return NextResponse.json(employee);
}

// DELETE /api/employees/[id] — Soft-delete (archive) an employee
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { result: employee, error } = await withPrismaError("Failed to archive employee", () =>
    prisma.employee.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: session.user.id,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Employee",
    entityId: employee.id,
    action: "ARCHIVE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(employee);
}
