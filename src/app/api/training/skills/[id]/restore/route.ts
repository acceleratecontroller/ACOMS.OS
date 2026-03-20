import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// POST /api/training/skills/[id]/restore
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { result: skill, error } = await withPrismaError("Failed to restore training skill", () =>
    prisma.trainingSkill.update({
      where: { id },
      data: { isArchived: false, archivedAt: null, archivedById: null },
    }),
  );
  if (error) return error;

  audit({
    entityType: "TrainingSkill",
    entityId: skill.id,
    action: "RESTORE",
    entityLabel: `${skill.name} (${skill.skillNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(skill);
}
