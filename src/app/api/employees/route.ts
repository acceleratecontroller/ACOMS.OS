import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createEmployeeSchema } from "@/modules/employees/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/employees — List all active (non-archived) employees
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result, error } = await withPrismaError("Failed to list employees", () =>
    prisma.employee.findMany({
      where: { isArchived: showArchived },
      include: {
        trainingRoles: {
          include: { role: { select: { id: true, name: true, roleNumber: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/employees — Create a new employee
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Auto-generate employee number: E0001, E0002, etc.
  const lastEmployee = await prisma.employee.findFirst({
    orderBy: { employeeNumber: "desc" },
  });

  let nextNumber = 1;
  if (lastEmployee) {
    const match = lastEmployee.employeeNumber.match(/E(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const employeeNumber = `E${String(nextNumber).padStart(4, "0")}`;

  // Auto-resolve status based on end date
  let status = data.status;
  if (data.endDate) {
    const end = new Date(data.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end <= today) status = "TERMINATED";
  }

  const { result: employee, error } = await withPrismaError("Failed to create employee", () =>
    prisma.employee.create({
      data: {
        employeeNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        personalEmail: data.personalEmail || null,
        phone: data.phone || null,
        address: data.address || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        shirtSize: data.shirtSize || null,
        pantsSize: data.pantsSize || null,
        employmentType: data.employmentType,
        location: data.location,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        probationDate: data.probationDate ? new Date(data.probationDate) : null,
        status,
        notes: data.notes || null,
        createdById: session.user.id,
        trainingRoles: data.roleIds.length > 0
          ? { create: data.roleIds.map((roleId: string) => ({ roleId })) }
          : undefined,
      },
      include: {
        trainingRoles: {
          include: { role: { select: { id: true, name: true, roleNumber: true } } },
        },
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Employee",
    entityId: employee.id,
    action: "CREATE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(employee, { status: 201 });
}
