import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createSkillSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/skills
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result, error } = await withPrismaError("Failed to list training skills", () =>
    prisma.trainingSkill.findMany({
      where: { isArchived: showArchived },
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
            role: {
              select: { id: true, roleNumber: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(result);
}

// POST /api/training/skills
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const last = await prisma.trainingSkill.findFirst({
    orderBy: { skillNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.skillNumber.match(/SKILL-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const skillNumber = `SKILL-${String(nextNum).padStart(4, "0")}`;

  const { result: skill, error } = await withPrismaError("Failed to create training skill", () =>
    prisma.trainingSkill.create({
      data: {
        skillNumber,
        name: data.name,
        description: data.description || null,
        createdById: session.user.id,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "TrainingSkill",
    entityId: skill.id,
    action: "CREATE",
    entityLabel: `${skill.name} (${skill.skillNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(skill, { status: 201 });
}
