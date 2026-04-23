import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { parseBody, withPrismaError } from "@/shared/api/helpers";
import {
  backfillForSkillAccreditationLink,
  cleanupOrphanedPendingAndExempt,
  employeeIdsWithSkill,
} from "@/modules/training/requirements";

// GET /api/training/skills/[id]/accreditations (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result, error } = await withPrismaError("Failed to list skill accreditations", () =>
    prisma.skillAccreditationLink.findMany({
      where: { skillId: id },
      select: {
        id: true,
        required: true,
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/training/skills/[id]/accreditations — Link accreditation to skill
export async function POST(
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

  const { accreditationId, required } = body as { accreditationId?: string; required?: boolean };
  if (!accreditationId) {
    return NextResponse.json({ error: "accreditationId is required" }, { status: 400 });
  }
  const req = required !== false; // default true

  const { result: link, error } = await withPrismaError("Failed to link accreditation to skill", () =>
    prisma.skillAccreditationLink.create({
      data: { skillId: id, accreditationId, required: req },
      select: {
        id: true,
        required: true,
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  await backfillForSkillAccreditationLink(id, accreditationId, req);

  return NextResponse.json(link, { status: 201 });
}

// PATCH /api/training/skills/[id]/accreditations — Update required flag on a link
export async function PATCH(
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

  const { accreditationId, required } = body as { accreditationId?: string; required?: boolean };
  if (!accreditationId || typeof required !== "boolean") {
    return NextResponse.json({ error: "accreditationId and required are both required" }, { status: 400 });
  }

  const { result: link, error } = await withPrismaError("Failed to update skill-accreditation link", () =>
    prisma.skillAccreditationLink.update({
      where: { skillId_accreditationId: { skillId: id, accreditationId } },
      data: { required },
      select: {
        id: true,
        required: true,
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(link);
}

// DELETE /api/training/skills/[id]/accreditations — Unlink accreditation from skill
// Also cleans up orphaned PENDING/EXEMPT accreditation rows for any employee
// whose roles reference this skill (VERIFIED/EXPIRED rows are always kept).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const accreditationId = request.nextUrl.searchParams.get("accreditationId");
  if (!accreditationId) {
    return NextResponse.json({ error: "accreditationId query param is required" }, { status: 400 });
  }

  const affectedEmployeeIds = await employeeIdsWithSkill(id);

  const { error } = await withPrismaError("Failed to unlink accreditation from skill", () =>
    prisma.skillAccreditationLink.delete({
      where: { skillId_accreditationId: { skillId: id, accreditationId } },
    }),
  );
  if (error) return error;

  await cleanupOrphanedPendingAndExempt(affectedEmployeeIds);

  return NextResponse.json({ success: true });
}
