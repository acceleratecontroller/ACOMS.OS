import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { getDateBoundaries } from "@/shared/date-utils";

// GET /api/dashboard — Dashboard summary stats
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Date boundaries in Australian timezone (converted to UTC for Prisma queries)
  const { today, tomorrow } = getDateBoundaries();

  // Filter tasks to logged-in employee by default
  const employeeId = session.user.employeeId ?? null;
  const taskOwnerFilter = employeeId ? { ownerId: employeeId } : {};

  const [
    activeTaskCount,
    overdueTaskCount,
    overdueTasks,
    dueTodayTaskCount,
    dueTodayTasks,
    overdueRecurringCount,
    overdueRecurringTasks,
    dueTodayRecurringCount,
    dueTodayRecurringTasks,
    upcomingTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: { isArchived: false, status: { not: "COMPLETED" }, ...taskOwnerFilter },
    }),
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
        ...taskOwnerFilter,
      },
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
        ...taskOwnerFilter,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.recurringTask.count({
      where: {
        isArchived: false,
        nextDue: { lt: today },
        ...taskOwnerFilter,
      },
    }),
    prisma.recurringTask.findMany({
      where: {
        isArchived: false,
        nextDue: { lt: today },
        ...taskOwnerFilter,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { nextDue: "asc" },
      take: 5,
    }),
    prisma.recurringTask.count({
      where: {
        isArchived: false,
        nextDue: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
    }),
    prisma.recurringTask.findMany({
      where: {
        isArchived: false,
        nextDue: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { nextDue: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today },
        ...taskOwnerFilter,
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    activeTaskCount,
    overdueTaskCount,
    overdueRecurringCount,
    overdueTasks,
    overdueRecurringTasks,
    dueTodayTaskCount,
    dueTodayTasks,
    dueTodayRecurringCount,
    dueTodayRecurringTasks,
    upcomingTasks,
  });
}
