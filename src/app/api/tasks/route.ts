import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { createTaskSchema } from "@/modules/tasks/validation";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";

// GET /api/tasks — List tasks
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const tasks = await prisma.task.findMany({
    where: { isArchived: showArchived },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

// POST /api/tasks — Create a new task
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const task = await prisma.task.create({
      data: {
        title: data.title,
        projectId: data.projectId || null,
        notes: data.notes || null,
        label: data.label || "Task",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status,
        priority: data.priority,
        ownerId: data.ownerId,
        createdById: session.user.id,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    });

    audit({
      entityType: "Task",
      entityId: task.id,
      action: "CREATE",
      entityLabel: task.title,
      performedById: session.user.id,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error("Failed to create task:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create task: ${message}` }, { status: 500 });
  }
}
