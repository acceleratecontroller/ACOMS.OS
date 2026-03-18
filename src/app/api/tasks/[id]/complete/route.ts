import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// POST /api/tasks/[id]/complete — Toggle task completion
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newStatus = task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";

  const { result: updated, error } = await withPrismaError("Failed to toggle task completion", () =>
    prisma.task.update({
      where: { id },
      data: { status: newStatus },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "Task",
    entityId: task.id,
    action: "UPDATE",
    entityLabel: task.title,
    performedById: session.user.id,
    changes: { status: { from: task.status, to: newStatus } },
  });

  return NextResponse.json(updated);
}
