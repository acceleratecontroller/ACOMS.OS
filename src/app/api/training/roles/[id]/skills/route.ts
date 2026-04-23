import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { parseBody, withPrismaError } from "@/shared/api/helpers";
import {
  backfillForRoleSkillLink,
  cleanupOrphanedPendingAndExempt,
  employeeIdsWithRole,
} from "@/modules/training/requirements";

// GET /api/training/roles/[id]/skills — List skills linked to this role (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result, error } = await withPrismaError("Failed to list role skills", () =>
    prisma.roleSkillLink.findMany({
      where: { roleId: id },
      select: {
        id: true,
        required: true,
        skill: {
          select: { id: true, skillNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/training/roles/[id]/skills — Link a skill to this role
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

  const { skillId, required } = body as { skillId?: string; required?: boolean };
  if (!skillId) {
    return NextResponse.json({ error: "skillId is required" }, { status: 400 });
  }
  const req = required !== false;

  const { result: link, error } = await withPrismaError("Failed to link skill to role", () =>
    prisma.roleSkillLink.create({
      data: { roleId: id, skillId, required: req },
      select: {
        id: true,
        required: true,
        skill: {
          select: { id: true, skillNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  await backfillForRoleSkillLink(id, skillId, req);

  return NextResponse.json(link, { status: 201 });
}

// PATCH /api/training/roles/[id]/skills — Toggle required flag on a role-skill link
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

  const { skillId, required } = body as { skillId?: string; required?: boolean };
  if (!skillId || typeof required !== "boolean") {
    return NextResponse.json({ error: "skillId and required are both required" }, { status: 400 });
  }

  const { result: link, error } = await withPrismaError("Failed to update role-skill link", () =>
    prisma.roleSkillLink.update({
      where: { roleId_skillId: { roleId: id, skillId } },
      data: { required },
      select: {
        id: true,
        required: true,
        skill: {
          select: { id: true, skillNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(link);
}

// DELETE /api/training/roles/[id]/skills — Unlink a skill from this role
// Also cleans up orphaned PENDING/EXEMPT accreditation rows for any
// employee assigned this role (VERIFIED/EXPIRED rows are always kept).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const skillId = request.nextUrl.searchParams.get("skillId");
  if (!skillId) {
    return NextResponse.json({ error: "skillId query param is required" }, { status: 400 });
  }

  const affectedEmployeeIds = await employeeIdsWithRole(id);

  const { error } = await withPrismaError("Failed to unlink skill from role", () =>
    prisma.roleSkillLink.delete({
      where: { roleId_skillId: { roleId: id, skillId } },
    }),
  );
  if (error) return error;

  await cleanupOrphanedPendingAndExempt(affectedEmployeeIds);

  return NextResponse.json({ success: true });
}
