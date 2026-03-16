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

  const employee = await prisma.employee.create({
    data: {
      employeeNumber: data.employeeNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      position: data.position,
      department: data.department || null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status,
      notes: data.notes || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
