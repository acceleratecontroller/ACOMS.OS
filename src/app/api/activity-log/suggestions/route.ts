import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// GET /api/activity-log/suggestions?q=term — Autocomplete for activity log keyword filter
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Search entity labels and performer names in audit logs
  const [byLabel, byPerformer] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityLabel: { contains: q, mode: "insensitive" } },
      select: { entityLabel: true, entityType: true },
      distinct: ["entityLabel"],
      take: 8,
      orderBy: { performedAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { performedBy: { name: { contains: q, mode: "insensitive" } } },
      select: { performedBy: { select: { name: true } } },
      distinct: ["performedById"],
      take: 5,
      orderBy: { performedAt: "desc" },
    }),
  ]);

  const suggestions: { label: string; type: string }[] = [];
  const seen = new Set<string>();

  for (const row of byLabel) {
    if (!seen.has(row.entityLabel)) {
      seen.add(row.entityLabel);
      suggestions.push({ label: row.entityLabel, type: row.entityType });
    }
  }
  for (const row of byPerformer) {
    const name = row.performedBy.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      suggestions.push({ label: name, type: "User" });
    }
  }

  return NextResponse.json(suggestions.slice(0, 10));
}
