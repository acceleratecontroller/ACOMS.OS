import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { parseBody, withPrismaError } from "@/shared/api/helpers";

// GET /api/assets/categories — list all (optional ?q= filter, used by combobox)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const { result, error } = await withPrismaError("Failed to list asset categories", () =>
    prisma.assetCategory.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    }),
  );
  if (error) return error;

  return NextResponse.json(
    result.map((c) => ({ id: c.id, name: c.name, useCount: c._count.assets })),
  );
}

// POST /api/assets/categories — create new (case-insensitive duplicate check)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const name = (body as { name?: string }).name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Case-insensitive duplicate guard: if one already exists return it
  const existing = await prisma.assetCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return NextResponse.json({ id: existing.id, name: existing.name }, { status: 200 });

  const { result, error } = await withPrismaError("Failed to create asset category", () =>
    prisma.assetCategory.create({ data: { name } }),
  );
  if (error) return error;

  return NextResponse.json({ id: result.id, name: result.name }, { status: 201 });
}
