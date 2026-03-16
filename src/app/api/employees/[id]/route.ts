import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateEmployeeSchema } from "@/modules/employees/validation";
import { auth } from "@/shared/auth/auth";

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
  const employee = await prisma.employee.findUnique({ where: { id } });

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
  const body = await request.json();
  const parsed = updateEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.roleType !== undefined && { roleType: data.roleType }),
      ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.probationDate !== undefined && { probationDate: data.probationDate ? new Date(data.probationDate) : null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
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

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      isArchived: true,
      archivedAt: new Date(),
      archivedById: session.user.id,
    },
  });

  return NextResponse.json(employee);
}
