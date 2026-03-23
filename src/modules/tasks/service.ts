/**
 * Task service layer — encapsulates all business logic for Task and RecurringTask.
 *
 * This layer accepts its dependencies via the factory function, making it
 * portable across different apps (ACOMS.OS, WIP.OS, etc.) without changes.
 *
 * During extraction to the shared-tools repo, this file moves as-is.
 * The consuming app provides the dependencies (prisma, audit, assignee validation).
 */

import { calculateNextDue } from "./recurrence";
import type { CreateTaskInput, UpdateTaskInput, CreateRecurringTaskInput, UpdateRecurringTaskInput } from "./validation";

// ─── Dependency interfaces ──────────────────────────────

export interface TaskServiceDeps {
  prisma: {
    task: {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
      findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
      create: (args: Record<string, unknown>) => Promise<unknown>;
      update: (args: Record<string, unknown>) => Promise<unknown>;
      count: (args: Record<string, unknown>) => Promise<number>;
    };
    recurringTask: {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
      findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
      create: (args: Record<string, unknown>) => Promise<unknown>;
      update: (args: Record<string, unknown>) => Promise<unknown>;
      count: (args: Record<string, unknown>) => Promise<number>;
    };
  };
  audit: (entry: {
    entityType: string;
    entityId: string;
    action: string;
    entityLabel: string;
    performedById: string;
    changes?: Record<string, { from: unknown; to: unknown }> | null;
  }) => void;
  diff: (
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => Record<string, { from: unknown; to: unknown }> | null;
  validateAssignee: (id: string) => Promise<boolean>;
}

// ─── Owner include shape (consistent across all queries) ─

const OWNER_SELECT = { id: true, firstName: true, lastName: true, employeeNumber: true };

// ─── Quick Task Service ─────────────────────────────────

export function createTaskService(deps: TaskServiceDeps) {
  const { prisma, audit, diff, validateAssignee } = deps;

  return {
    async list(options: { archived?: boolean }) {
      return prisma.task.findMany({
        where: { isArchived: options.archived ?? false },
        include: { owner: { select: OWNER_SELECT } },
        orderBy: { createdAt: "desc" },
      });
    },

    async get(id: string) {
      return prisma.task.findUnique({
        where: { id },
        include: { owner: { select: OWNER_SELECT } },
      });
    },

    async create(data: CreateTaskInput, userId: string) {
      const valid = await validateAssignee(data.ownerId);
      if (!valid) return { error: "ownerId references a non-existent assignee" };

      const task = (await prisma.task.create({
        data: {
          title: data.title,
          projectId: data.projectId || null,
          notes: data.notes || null,
          label: data.label || "Task",
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: data.status,
          priority: data.priority,
          ownerId: data.ownerId,
          createdById: userId,
        },
        include: { owner: { select: OWNER_SELECT } },
      })) as { id: string; title: string };

      audit({
        entityType: "Task",
        entityId: task.id,
        action: "CREATE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async update(id: string, data: UpdateTaskInput, userId: string) {
      if (data.ownerId !== undefined) {
        const valid = await validateAssignee(data.ownerId!);
        if (!valid) return { error: "ownerId references a non-existent assignee" };
      }

      const before = (await prisma.task.findUnique({ where: { id } })) as Record<string, unknown> | null;
      if (!before) return { error: "not_found" };

      const task = (await prisma.task.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.projectId !== undefined && { projectId: data.projectId || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.label !== undefined && { label: data.label }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
        },
        include: { owner: { select: OWNER_SELECT } },
      })) as Record<string, unknown> & { id: string; title: string };

      const changes = diff(before, task);
      audit({
        entityType: "Task",
        entityId: task.id,
        action: "UPDATE",
        entityLabel: task.title,
        performedById: userId,
        changes,
      });

      return { task };
    },

    async archive(id: string, userId: string) {
      const task = (await prisma.task.update({
        where: { id },
        data: { isArchived: true, archivedAt: new Date(), archivedById: userId },
      })) as { id: string; title: string };

      audit({
        entityType: "Task",
        entityId: task.id,
        action: "ARCHIVE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async restore(id: string, userId: string) {
      const task = (await prisma.task.update({
        where: { id },
        data: { isArchived: false, archivedAt: null, archivedById: null },
      })) as { id: string; title: string };

      audit({
        entityType: "Task",
        entityId: task.id,
        action: "RESTORE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async toggleComplete(id: string, userId: string) {
      const task = (await prisma.task.findUnique({ where: { id } })) as { id: string; title: string; status: string } | null;
      if (!task) return { error: "not_found" };

      const newStatus = task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";
      const updated = await prisma.task.update({
        where: { id },
        data: { status: newStatus },
        include: { owner: { select: OWNER_SELECT } },
      });

      audit({
        entityType: "Task",
        entityId: task.id,
        action: "UPDATE",
        entityLabel: task.title,
        performedById: userId,
        changes: { status: { from: task.status, to: newStatus } },
      });

      return { task: updated };
    },
  };
}

// ─── Recurring Task Service ─────────────────────────────

export function createRecurringTaskService(deps: TaskServiceDeps) {
  const { prisma, audit, diff, validateAssignee } = deps;

  return {
    async list(options: { archived?: boolean }) {
      return prisma.recurringTask.findMany({
        where: { isArchived: options.archived ?? false },
        include: { owner: { select: OWNER_SELECT } },
        orderBy: { createdAt: "desc" },
      });
    },

    async get(id: string) {
      return prisma.recurringTask.findUnique({
        where: { id },
        include: { owner: { select: OWNER_SELECT } },
      });
    },

    async create(data: CreateRecurringTaskInput, userId: string) {
      const valid = await validateAssignee(data.ownerId);
      if (!valid) return { error: "ownerId references a non-existent assignee" };

      const lastCompleted = data.lastCompleted ? new Date(data.lastCompleted) : null;
      const nextDue = calculateNextDue(
        data.frequencyType,
        data.frequencyValue,
        data.scheduleType,
        lastCompleted,
        null,
      );

      const task = (await prisma.recurringTask.create({
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
          createdById: userId,
        },
        include: { owner: { select: OWNER_SELECT } },
      })) as { id: string; title: string };

      audit({
        entityType: "RecurringTask",
        entityId: task.id,
        action: "CREATE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async update(id: string, data: UpdateRecurringTaskInput, userId: string) {
      if (data.ownerId !== undefined) {
        const valid = await validateAssignee(data.ownerId!);
        if (!valid) return { error: "ownerId references a non-existent assignee" };
      }

      const before = (await prisma.recurringTask.findUnique({ where: { id } })) as Record<string, unknown> & {
        frequencyType: string;
        frequencyValue: number;
        scheduleType: "FIXED" | "FLOATING";
        lastCompleted: Date | null;
        nextDue: Date | null;
      } | null;
      if (!before) return { error: "not_found" };

      // Recalculate nextDue if frequency/schedule/lastCompleted changed
      let nextDue: Date | null | undefined;
      const freqType = data.frequencyType ?? before.frequencyType;
      const freqValue = data.frequencyValue ?? before.frequencyValue;
      const schedType = data.scheduleType ?? before.scheduleType;
      const lastCompleted = data.lastCompleted !== undefined
        ? data.lastCompleted ? new Date(data.lastCompleted) : null
        : before.lastCompleted;

      const changed =
        (data.frequencyType !== undefined && data.frequencyType !== before.frequencyType) ||
        (data.frequencyValue !== undefined && data.frequencyValue !== before.frequencyValue) ||
        (data.scheduleType !== undefined && data.scheduleType !== before.scheduleType) ||
        (data.lastCompleted !== undefined &&
          String(data.lastCompleted || "") !== String(before.lastCompleted?.toISOString().slice(0, 10) || ""));

      if (changed) {
        nextDue = calculateNextDue(freqType, freqValue, schedType as "FIXED" | "FLOATING", lastCompleted, null);
      }

      const task = (await prisma.recurringTask.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.frequencyType !== undefined && { frequencyType: data.frequencyType }),
          ...(data.frequencyValue !== undefined && { frequencyValue: data.frequencyValue }),
          ...(data.scheduleType !== undefined && { scheduleType: data.scheduleType }),
          ...(data.lastCompleted !== undefined && { lastCompleted: data.lastCompleted ? new Date(data.lastCompleted) : null }),
          ...(nextDue !== undefined && { nextDue }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
        },
        include: { owner: { select: OWNER_SELECT } },
      })) as Record<string, unknown> & { id: string; title: string };

      const changes = diff(before, task);
      audit({
        entityType: "RecurringTask",
        entityId: task.id,
        action: "UPDATE",
        entityLabel: task.title,
        performedById: userId,
        changes,
      });

      return { task };
    },

    async archive(id: string, userId: string) {
      const task = (await prisma.recurringTask.update({
        where: { id },
        data: { isArchived: true, archivedAt: new Date(), archivedById: userId },
      })) as { id: string; title: string };

      audit({
        entityType: "RecurringTask",
        entityId: task.id,
        action: "ARCHIVE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async restore(id: string, userId: string) {
      const task = (await prisma.recurringTask.update({
        where: { id },
        data: { isArchived: false, archivedAt: null, archivedById: null },
      })) as { id: string; title: string };

      audit({
        entityType: "RecurringTask",
        entityId: task.id,
        action: "RESTORE",
        entityLabel: task.title,
        performedById: userId,
      });

      return { task };
    },

    async complete(id: string, userId: string) {
      const task = (await prisma.recurringTask.findUnique({ where: { id } })) as {
        id: string;
        title: string;
        frequencyType: string;
        frequencyValue: number;
        scheduleType: "FIXED" | "FLOATING";
        lastCompleted: Date | null;
        nextDue: Date | null;
      } | null;
      if (!task) return { error: "not_found" };

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const nextDue = calculateNextDue(
        task.frequencyType,
        task.frequencyValue,
        task.scheduleType,
        now,
        task.nextDue,
      );

      const updated = await prisma.recurringTask.update({
        where: { id },
        data: { lastCompleted: now, nextDue },
        include: { owner: { select: OWNER_SELECT } },
      });

      audit({
        entityType: "RecurringTask",
        entityId: task.id,
        action: "UPDATE",
        entityLabel: task.title,
        performedById: userId,
        changes: {
          lastCompleted: { from: task.lastCompleted, to: now },
          nextDue: { from: task.nextDue, to: nextDue },
        },
      });

      return { task: updated };
    },
  };
}
