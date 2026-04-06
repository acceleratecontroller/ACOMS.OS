import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// GET /api/activity-log/suggestions?q=term — Autocomplete for activity log keyword filter (admin only)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Search entity labels in audit logs (performer name lookup removed — identities live in ACOMS.Auth)
  const byLabel = await prisma.auditLog.findMany({
    where: { entityLabel: { contains: q, mode: "insensitive" } },
    select: { entityLabel: true, entityType: true },
    distinct: ["entityLabel"],
    take: 10,
    orderBy: { performedAt: "desc" },
  });

  const suggestions: { label: string; type: string }[] = [];
  const seen = new Set<string>();

  for (const row of byLabel) {
    if (!seen.has(row.entityLabel)) {
      seen.add(row.entityLabel);
      suggestions.push({ label: row.entityLabel, type: row.entityType });
    }
  }

  return NextResponse.json(suggestions.slice(0, 10));
}
