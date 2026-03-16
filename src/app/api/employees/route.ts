import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createEmployeeSchema } from "@/modules/employees/validation";
import { auth } from "@/shared/auth/auth";

// GET /api/employees — List all active (non-archived) employees
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const employees = await prisma.employee.findMany({
    where: { isArchived: showArchived },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(employees);
}

// POST /api/employees — Create a new employee
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
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

  const employee = await prisma.employee.create({
    data: {
      employeeNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      roleType: data.roleType,
      employmentType: data.employmentType,
      location: data.location,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      probationDate: data.probationDate ? new Date(data.probationDate) : null,
      status,
      notes: data.notes || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
