import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// PATCH /api/assets/owners/[id] — rename
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const name = (body as { name?: string }).name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const dup = await prisma.assetOwner.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (dup) return NextResponse.json({ error: "Another owner already uses that name" }, { status: 409 });

  const { result, error } = await withPrismaError("Failed to rename asset owner", () =>
    prisma.assetOwner.update({ where: { id }, data: { name } }),
  );
  if (error) return error;

  return NextResponse.json({ id: result.id, name: result.name });
}

// DELETE /api/assets/owners/[id] — only when unused
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const inUse = await prisma.asset.count({ where: { externalOwnerId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `In use by ${inUse} asset${inUse === 1 ? "" : "s"}` },
      { status: 409 },
    );
  }

  const { error } = await withPrismaError("Failed to delete asset owner", () =>
    prisma.assetOwner.delete({ where: { id } }),
  );
  if (error) return error;

  return NextResponse.json({ success: true });
}
