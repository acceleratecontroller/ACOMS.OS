import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateAccreditationSchema } from "@/modules/training/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/training/accreditations/[id] (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { result: accreditation, error } = await withPrismaError("Failed to get accreditation", () =>
    prisma.accreditation.findUnique({
      where: { id },
      include: {
        skillLinks: {
          include: {
            skill: { select: { id: true, skillNumber: true, name: true } },
          },
        },
      },
    }),
  );
  if (error) return error;
  if (!accreditation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(accreditation);
}

// PUT /api/training/accreditations/[id]
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

  const parsed = updateAccreditationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const before = await prisma.accreditation.findUnique({ where: { id } });

  const { result: accreditation, error } = await withPrismaError("Failed to update accreditation", () =>
    prisma.accreditation.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code || null }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.expires !== undefined && { expires: data.expires }),
        ...(data.renewalMonths !== undefined && { renewalMonths: data.renewalMonths ?? null }),
        ...(data.renewalNotes !== undefined && { renewalNotes: data.renewalNotes || null }),
      },
    }),
  );
  if (error) return error;

  const changes = before ? diff(before as unknown as Record<string, unknown>, accreditation as unknown as Record<string, unknown>) : null;
  audit({
    entityType: "Accreditation",
    entityId: accreditation.id,
    action: "UPDATE",
    entityLabel: `${accreditation.name} (${accreditation.accreditationNumber})`,
    performedById: session.user.identityId,
    changes,
  });

  return NextResponse.json(accreditation);
}

// DELETE /api/training/accreditations/[id] — Archive
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { result: accreditation, error } = await withPrismaError("Failed to archive accreditation", () =>
    prisma.accreditation.update({
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
    entityType: "Accreditation",
    entityId: accreditation.id,
    action: "ARCHIVE",
    entityLabel: `${accreditation.name} (${accreditation.accreditationNumber})`,
    performedById: session.user.identityId,
  });

  return NextResponse.json(accreditation);
}
