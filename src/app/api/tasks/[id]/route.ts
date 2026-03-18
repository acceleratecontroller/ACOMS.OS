import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { updateTaskSchema } from "@/modules/tasks/validation";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";

// GET /api/tasks/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

// PUT /api/tasks/[id] — Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const before = await prisma.task.findUnique({ where: { id } });

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.projectId !== undefined && { projectId: data.projectId || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.dueDate !== undefined && {
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
    });

    const changes = before
      ? diff(
          before as unknown as Record<string, unknown>,
          task as unknown as Record<string, unknown>,
        )
      : null;

    audit({
      entityType: "Task",
      entityId: task.id,
      action: "UPDATE",
      entityLabel: task.title,
      performedById: session.user.id,
      changes,
    });

    return NextResponse.json(task);
  } catch (err) {
    console.error("Failed to update task:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to update task: ${message}` }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — Soft-delete (archive)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const task = await prisma.task.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: session.user.id,
      },
    });

    audit({
      entityType: "Task",
      entityId: task.id,
      action: "ARCHIVE",
      entityLabel: task.title,
      performedById: session.user.id,
    });

    return NextResponse.json(task);
  } catch (err) {
    console.error("Failed to archive task:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to archive task: ${message}` }, { status: 500 });
  }
}
