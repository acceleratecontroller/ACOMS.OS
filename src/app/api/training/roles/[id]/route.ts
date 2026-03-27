import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateRoleSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/roles/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: role, error } = await withPrismaError("Failed to get training role", () =>
    prisma.trainingRole.findUnique({
      where: { id },
      include: {
        skillLinks: {
          include: {
            skill: {
              select: { id: true, skillNumber: true, name: true, isArchived: true },
            },
          },
        },
      },
    }),
  );
  if (error) return error;
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(role);
}

// PUT /api/training/roles/[id]
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

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const before = await prisma.trainingRole.findUnique({ where: { id } });

  const { result: role, error } = await withPrismaError("Failed to update training role", () =>
    prisma.trainingRole.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: data.category }),
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, role as unknown as Record<string, unknown>) : null;
  audit({
    entityType: "TrainingRole",
    entityId: role.id,
    action: "UPDATE",
    entityLabel: `${role.name} (${role.roleNumber})`,
    performedById: session.user.identityId,
    changes,
  });

  return NextResponse.json(role);
}

// DELETE /api/training/roles/[id] — Archive
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { result: role, error } = await withPrismaError("Failed to archive training role", () =>
    prisma.trainingRole.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: session.user.identityId,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "TrainingRole",
    entityId: role.id,
    action: "ARCHIVE",
    entityLabel: `${role.name} (${role.roleNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(role);
}
