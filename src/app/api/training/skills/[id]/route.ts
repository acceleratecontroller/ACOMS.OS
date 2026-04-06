import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateSkillSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/skills/[id] (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: skill, error } = await withPrismaError("Failed to get training skill", () =>
    prisma.trainingSkill.findUnique({
      where: { id },
      include: {
        accreditationLinks: {
          include: {
            accreditation: {
              select: { id: true, accreditationNumber: true, name: true, isArchived: true },
            },
          },
        },
        roleLinks: {
          include: {
            role: { select: { id: true, roleNumber: true, name: true } },
          },
        },
      },
    }),
  );
  if (error) return error;
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(skill);
}

// PUT /api/training/skills/[id]
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

  const parsed = updateSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const before = await prisma.trainingSkill.findUnique({ where: { id } });

  const { result: skill, error } = await withPrismaError("Failed to update training skill", () =>
    prisma.trainingSkill.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, skill as unknown as Record<string, unknown>) : null;
  audit({
    entityType: "TrainingSkill",
    entityId: skill.id,
    action: "UPDATE",
    entityLabel: `${skill.name} (${skill.skillNumber})`,
    performedById: session.user.identityId,
    changes,
  });

  return NextResponse.json(skill);
}

// DELETE /api/training/skills/[id] — Archive
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { result: skill, error } = await withPrismaError("Failed to archive training skill", () =>
    prisma.trainingSkill.update({
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
    entityType: "TrainingSkill",
    entityId: skill.id,
    action: "ARCHIVE",
    entityLabel: `${skill.name} (${skill.skillNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(skill);
}
