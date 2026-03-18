import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { calculateNextDue } from "@/modules/tasks/recurrence";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// POST /api/recurring-tasks/[id]/complete — Mark as completed and advance next due
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const task = await prisma.recurringTask.findUnique({ where: { id } });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const nextDue = calculateNextDue(
    task.frequencyType,
    task.frequencyValue,
    task.scheduleType,
    now,
    task.nextDue,
  );

  const { result: updated, error } = await withPrismaError("Failed to complete recurring task", () =>
    prisma.recurringTask.update({
      where: { id },
      data: {
        lastCompleted: now,
        nextDue,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    }),
  );
  if (error) return error;

  audit({
    entityType: "RecurringTask",
    entityId: task.id,
    action: "UPDATE",
    entityLabel: task.title,
    performedById: session.user.id,
    changes: {
      lastCompleted: { from: task.lastCompleted, to: now },
      nextDue: { from: task.nextDue, to: nextDue },
    },
  });

  return NextResponse.json(updated);
}
