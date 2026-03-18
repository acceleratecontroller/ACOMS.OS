import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// GET /api/dashboard — Dashboard summary stats
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeTaskCount,
    overdueTaskCount,
    overdueTasks,
    overdueRecurringCount,
    overdueRecurringTasks,
    upcomingTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: { isArchived: false, status: { not: "COMPLETED" } },
    }),
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
      },
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
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
      },
    }),
    prisma.recurringTask.findMany({
      where: {
        isArchived: false,
        nextDue: { lt: today },
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
    upcomingTasks,
  });
}
