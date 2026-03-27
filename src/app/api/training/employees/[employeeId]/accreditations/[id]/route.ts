import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateEmployeeAccreditationSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// PUT /api/training/employees/[employeeId]/accreditations/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = updateEmployeeAccreditationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const before = await prisma.employeeAccreditation.findUnique({ where: { id } });

  const { result: ea, error } = await withPrismaError("Failed to update employee accreditation", () =>
    prisma.employeeAccreditation.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.issueDate !== undefined && { issueDate: data.issueDate ? new Date(data.issueDate) : null }),
        ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
        ...(data.certificateNumber !== undefined && { certificateNumber: data.certificateNumber || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.evidenceNotes !== undefined && { evidenceNotes: data.evidenceNotes || null }),
      },
      include: {
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true },
        },
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, ea as unknown as Record<string, unknown>) : null;
  audit({
    entityType: "EmployeeAccreditation",
    entityId: ea.id,
    action: "UPDATE",
    entityLabel: `${ea.accreditation.name} for employee`,
    performedById: session.user.identityId,
    changes,
  });

  return NextResponse.json(ea);
}

// DELETE /api/training/employees/[employeeId]/accreditations/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ employeeId: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { result: ea, error } = await withPrismaError("Failed to remove accreditation", () =>
    prisma.employeeAccreditation.delete({
      where: { id },
      include: {
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true },
        },
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "EmployeeAccreditation",
    entityId: ea.id,
    action: "DELETE",
    entityLabel: `${ea.accreditation.name} removed from employee`,
    performedById: session.user.identityId,
  });

  return NextResponse.json({ success: true });
}
