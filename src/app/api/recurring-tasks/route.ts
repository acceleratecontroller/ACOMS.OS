import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createRecurringTaskSchema } from "@/modules/tasks/validation";
import { calculateNextDue } from "@/modules/tasks/recurrence";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { parseBody, validateEmployeeRef, withPrismaError } from "@/shared/api/helpers";

// GET /api/recurring-tasks — List recurring tasks
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const tasks = await prisma.recurringTask.findMany({
    where: { isArchived: showArchived },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

// POST /api/recurring-tasks — Create a recurring task
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: body, error: bodyError } = await parseBody(request);
  if (bodyError) return bodyError;

  const parsed = createRecurringTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate ownerId references an existing employee
  const refError = await validateEmployeeRef(data.ownerId, "ownerId");
  if (refError) return refError;

  const lastCompleted = data.lastCompleted ? new Date(data.lastCompleted) : null;
  const nextDue = calculateNextDue(
    data.frequencyType,
    data.frequencyValue,
    data.scheduleType,
    lastCompleted,
    null,
  );

  const { result: task, error } = await withPrismaError("Failed to create recurring task", () =>
    prisma.recurringTask.create({
      data: {
        title: data.title,
        description: data.description || null,
        category: data.category || "Task",
        frequencyType: data.frequencyType,
        frequencyValue: data.frequencyValue,
        scheduleType: data.scheduleType,
        lastCompleted,
        nextDue,
        ownerId: data.ownerId,
        createdById: session.user.id,
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
    action: "CREATE",
    entityLabel: task.title,
    performedById: session.user.id,
  });

  return NextResponse.json(task, { status: 201 });
}
