import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// GET /api/activity-log — Paginated audit log with optional filters
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "50", 10)));
  const entityType = params.get("entityType") || undefined;
  const action = params.get("action") || undefined;
  const entityId = params.get("entityId") || undefined;

  const keyword = params.get("keyword") || undefined;

  const where = {
    ...(entityType && { entityType }),
    ...(action && { action }),
    ...(entityId && { entityId }),
    ...(keyword && {
      OR: [
        { entityLabel: { contains: keyword, mode: "insensitive" as const } },
        { performedById: { contains: keyword, mode: "insensitive" as const } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
