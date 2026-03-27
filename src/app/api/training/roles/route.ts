import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createRoleSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/roles
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result, error } = await withPrismaError("Failed to list training roles", () =>
    prisma.trainingRole.findMany({
      where: { isArchived: showArchived },
      include: {
        skillLinks: {
          include: {
            skill: {
              select: { id: true, skillNumber: true, name: true, isArchived: true },
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

// POST /api/training/roles
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const last = await prisma.trainingRole.findFirst({
    orderBy: { roleNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.roleNumber.match(/ROLE-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const roleNumber = `ROLE-${String(nextNum).padStart(4, "0")}`;

  const { result: role, error } = await withPrismaError("Failed to create training role", () =>
    prisma.trainingRole.create({
      data: {
        roleNumber,
        name: data.name,
        description: data.description || null,
        category: data.category,
        createdById: session.user.identityId,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "TrainingRole",
    entityId: role.id,
    action: "CREATE",
    entityLabel: `${role.name} (${role.roleNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(role, { status: 201 });
}
