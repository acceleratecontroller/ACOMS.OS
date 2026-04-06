import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

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
      include: {
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

  const accreditationId = (body as { accreditationId?: string }).accreditationId;
  if (!accreditationId) {
    return NextResponse.json({ error: "accreditationId is required" }, { status: 400 });
  }

  const { result: link, error } = await withPrismaError("Failed to link accreditation to skill", () =>
    prisma.skillAccreditationLink.create({
      data: { skillId: id, accreditationId },
      include: {
        accreditation: {
          select: { id: true, accreditationNumber: true, name: true, description: true, isArchived: true },
        },
      },
    }),
  );
  if (error) return error;

  return NextResponse.json(link, { status: 201 });
}

// DELETE /api/training/skills/[id]/accreditations — Unlink accreditation from skill
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

  const { error } = await withPrismaError("Failed to unlink accreditation from skill", () =>
    prisma.skillAccreditationLink.delete({
      where: { skillId_accreditationId: { skillId: id, accreditationId } },
    }),
  );
  if (error) return error;

  return NextResponse.json({ success: true });
}
