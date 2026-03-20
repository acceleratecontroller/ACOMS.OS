import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { assignEmployeeAccreditationSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/employees/[employeeId]/accreditations
// STAFF users can only view their own accreditations
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId } = await params;

  // STAFF can only view their own accreditations
  if (session.user.role !== "ADMIN" && employeeId !== session.user.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { result, error } = await withPrismaError("Failed to list employee accreditations", () =>
    prisma.employeeAccreditation.findMany({
      where: { employeeId },
      include: {
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/training/employees/[employeeId]/accreditations — Add an accreditation
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

  const parsed = assignEmployeeAccreditationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const { result: ea, error } = await withPrismaError("Failed to assign accreditation", () =>
    prisma.employeeAccreditation.create({
      data: {
        employeeId,
        accreditationId: data.accreditationId,
        status: data.status,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        certificateNumber: data.certificateNumber || null,
        notes: data.notes || null,
        evidenceNotes: data.evidenceNotes || null,
      },
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
    action: "CREATE",
    entityLabel: `${ea.accreditation.name} assigned to employee ${employeeId}`,
    performedById: session.user.id,
  });

  return NextResponse.json(ea, { status: 201 });
}
