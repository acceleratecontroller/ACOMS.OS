import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createAccreditationSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/accreditations
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { result, error } = await withPrismaError("Failed to list accreditations", () =>
    prisma.accreditation.findMany({
      where: { isArchived: showArchived },
      include: {
        skillLinks: {
          include: {
            skill: {
              select: { id: true, skillNumber: true, name: true },
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

// POST /api/training/accreditations
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createAccreditationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const last = await prisma.accreditation.findFirst({
    orderBy: { accreditationNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.accreditationNumber.match(/ACCR-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const accreditationNumber = `ACCR-${String(nextNum).padStart(4, "0")}`;

  const { result: accreditation, error } = await withPrismaError("Failed to create accreditation", () =>
    prisma.accreditation.create({
      data: {
        accreditationNumber,
        name: data.name,
        description: data.description || null,
        expires: data.expires,
        renewalMonths: data.renewalMonths ?? null,
        renewalNotes: data.renewalNotes || null,
        createdById: session.user.id,
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Accreditation",
    entityId: accreditation.id,
    action: "CREATE",
    entityLabel: `${accreditation.name} (${accreditation.accreditationNumber})`,
    performedById: session.user.id,
  });

  return NextResponse.json(accreditation, { status: 201 });
}
