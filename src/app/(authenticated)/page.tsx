import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { getDateBoundaries } from "@/shared/date-utils";
import { DashboardTaskCentre } from "./DashboardTaskCentre";
import type { DashboardTaskItem, DashboardEmployee } from "./DashboardTaskCentre";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const employeeId = session?.user?.employeeId ?? null;

  // STAFF users → redirect to the dedicated staff portal
  if (!isAdmin) {
    redirect("/staff");
  }

  const params = await searchParams;
  const viewAll = params.view === "all";
  // Filter tasks to logged-in employee unless "all" view is selected
  const taskOwnerFilter = !viewAll && employeeId ? { ownerId: employeeId } : {};

  // Date boundaries in Australian timezone (converted to UTC for Prisma queries)
  const { today, tomorrow, sevenDays: sevenDaysFromNow, thirtyDays: thirtyDaysFromNow } = getDateBoundaries();

  // Parallel fetch all dashboard data
  const [
    // Employee stats
    activeEmployees,
    totalEmployees,
    employeesByLocation,
    employeesByType,
    // Asset stats
    totalAssets,
    assetsByStatus,
    unassignedAssets,
    // Plant stats
    totalPlant,
    plantByStatus,
    plantServiceOverdue,
    plantServiceSoon,
    // Task stats
    activeTasks,
    overdueTasks,
    overdueTaskItems,
    highPriorityTasks,
    tasksDueToday,
    tasksDueTodayCount,
    tasksDueSoon,
    overdueRecurring,
    overdueRecurringTasks,
    recurringDueToday,
    recurringDueTodayCount,
    recurringDueSoon,
    // Recent activity
    recentActivity,
    // Training compliance
    expiredAccredEmployees,
    expiringSoonAccredEmployees,
    pendingAccredEmployees,
    employeesWithTrainingRoles,
    // Employee list for task edit forms
    employeesList,
  ] = await Promise.all([
    // Employees
    prisma.employee.count({ where: { isArchived: false, status: "ACTIVE" } }),
    prisma.employee.count({ where: { isArchived: false } }),
    prisma.employee.groupBy({
      by: ["location"],
      where: { isArchived: false, status: "ACTIVE" },
      _count: true,
    }),
    prisma.employee.groupBy({
      by: ["employmentType"],
      where: { isArchived: false, status: "ACTIVE" },
      _count: true,
    }),
    // Assets
    prisma.asset.count({ where: { isArchived: false } }),
    prisma.asset.groupBy({
      by: ["status"],
      where: { isArchived: false },
      _count: true,
    }),
    prisma.asset.count({ where: { isArchived: false, assignedToId: null } }),
    // Plant
    prisma.plant.count({ where: { isArchived: false } }),
    prisma.plant.groupBy({
      by: ["status"],
      where: { isArchived: false },
      _count: true,
    }),
    prisma.plant.findMany({
      where: { isArchived: false, nextServiceDue: { lt: today } },
      select: { id: true, plantNumber: true, make: true, model: true, nextServiceDue: true },
      orderBy: { nextServiceDue: "asc" },
      take: 5,
    }),
    prisma.plant.findMany({
      where: {
        isArchived: false,
        nextServiceDue: { gte: today, lte: sevenDaysFromNow },
      },
      select: { id: true, plantNumber: true, make: true, model: true, nextServiceDue: true },
      orderBy: { nextServiceDue: "asc" },
      take: 5,
    }),
    // Tasks (filtered to logged-in employee by default)
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
    // Overdue task items
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
        ...taskOwnerFilter,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        priority: "HIGH",
        ...taskOwnerFilter,
      },
    }),
    // Tasks due today
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
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
    // Tasks due this week (excluding today)
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: tomorrow, lte: sevenDaysFromNow },
        ...taskOwnerFilter,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.recurringTask.count({
      where: { isArchived: false, nextDue: { lt: today }, ...taskOwnerFilter },
    }),
    // Overdue recurring tasks (actual items)
    prisma.recurringTask.findMany({
      where: { isArchived: false, nextDue: { lt: today }, ...taskOwnerFilter },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { nextDue: "asc" },
      take: 5,
    }),
    // Recurring tasks due today
    prisma.recurringTask.findMany({
      where: {
        isArchived: false,
        nextDue: { gte: today, lt: tomorrow },
        ...taskOwnerFilter,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
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
    // Recurring tasks due this week (excluding today)
    prisma.recurringTask.findMany({
      where: {
        isArchived: false,
        nextDue: { gte: tomorrow, lte: sevenDaysFromNow },
        ...taskOwnerFilter,
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { nextDue: "asc" },
      take: 5,
    }),
    // Recent activity
    prisma.auditLog.findMany({
      orderBy: { performedAt: "desc" },
      take: 8,
    }),
    // Training: auto-expire then count expired
    prisma.employeeAccreditation.updateMany({
      where: {
        status: "VERIFIED",
        expiryDate: { lt: today },
        accreditation: { expires: true, isArchived: false },
      },
      data: { status: "EXPIRED" },
    }).then(() =>
      prisma.employeeAccreditation.findMany({
        where: {
          accreditation: { expires: true, isArchived: false },
          employee: { isArchived: false },
          status: "EXPIRED",
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
    ),
    // Training: employees with accreditations expiring within 30 days
    prisma.employeeAccreditation.findMany({
      where: {
        expiryDate: { gte: today, lte: thirtyDaysFromNow },
        accreditation: { expires: true, isArchived: false },
        employee: { isArchived: false },
        status: { not: "EXEMPT" },
      },
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
    // Training: employees with pending accreditations
    prisma.employeeAccreditation.findMany({
      where: {
        status: "PENDING",
        accreditation: { isArchived: false },
        employee: { isArchived: false },
      },
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
    // Training: employees missing required accreditations
    prisma.employee.findMany({
      where: { isArchived: false, trainingRoles: { some: {} } },
      select: {
        id: true,
        trainingRoles: {
          select: {
            role: {
              select: {
                skillLinks: {
                  select: {
                    skill: {
                      select: {
                        accreditationLinks: {
                          where: { accreditation: { isArchived: false } },
                          select: { accreditationId: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        accreditations: {
          select: { accreditationId: true },
        },
      },
    }),
    // Employee list for edit dropdowns
    prisma.employee.findMany({
      where: { isArchived: false, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const totalOverdue = overdueTasks + overdueRecurring;

  // Count employees missing at least one required accreditation
  let missingAccredCount = 0;
  for (const emp of employeesWithTrainingRoles) {
    const requiredIds = new Set<string>();
    for (const tr of emp.trainingRoles) {
      for (const sl of tr.role.skillLinks) {
        for (const al of sl.skill.accreditationLinks) {
          requiredIds.add(al.accreditationId);
        }
      }
    }
    const heldIds = new Set(emp.accreditations.map((a: { accreditationId: string }) => a.accreditationId));
    for (const reqId of requiredIds) {
      if (!heldIds.has(reqId)) {
        missingAccredCount++;
        break;
      }
    }
  }
  const totalAccredIssues = expiredAccredEmployees.length + pendingAccredEmployees.length + missingAccredCount;

  // Build status maps
  const assetStatusMap: Record<string, number> = {};
  for (const g of assetsByStatus) assetStatusMap[g.status] = g._count;

  const plantStatusMap: Record<string, number> = {};
  for (const g of plantByStatus) plantStatusMap[g.status] = g._count;

  const locationMap: Record<string, number> = {};
  for (const g of employeesByLocation) locationMap[g.location] = g._count;

  const typeMap: Record<string, number> = {};
  for (const g of employeesByType) typeMap[g.employmentType] = g._count;

  // Compute counts
  const totalDueToday = tasksDueTodayCount + recurringDueTodayCount;
  const totalDueSoon = tasksDueSoon.length + recurringDueSoon.length;
  const totalRecurringDue = overdueRecurring + recurringDueTodayCount + recurringDueSoon.length;

  // Build all task rows for the command centre (with edit form data)
  const allTaskItems: DashboardTaskItem[] = [
    ...overdueTaskItems.map((t) => ({ id: t.id, title: t.title, type: "task" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, priority: t.priority, status: "overdue" as const, dateLabel: t.dueDate ? formatDate(t.dueDate) : "", projectId: t.projectId, notes: t.notes, label: t.label, dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null, taskStatus: t.status })),
    ...overdueRecurringTasks.map((t) => ({ id: `r-${t.id}`, title: t.title, type: "recurring" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, status: "overdue" as const, dateLabel: t.nextDue ? formatDate(t.nextDue) : "", description: t.description, category: t.category, frequencyType: t.frequencyType, frequencyValue: t.frequencyValue, scheduleType: t.scheduleType, lastCompleted: t.lastCompleted ? new Date(t.lastCompleted).toISOString() : null, nextDue: t.nextDue ? new Date(t.nextDue).toISOString() : null })),
    ...tasksDueToday.map((t) => ({ id: `td-${t.id}`, title: t.title, type: "task" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, priority: t.priority, status: "due-today" as const, dateLabel: "Today", projectId: t.projectId, notes: t.notes, label: t.label, dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null, taskStatus: t.status })),
    ...recurringDueToday.map((t) => ({ id: `rt-${t.id}`, title: t.title, type: "recurring" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, status: "due-today" as const, dateLabel: "Today", description: t.description, category: t.category, frequencyType: t.frequencyType, frequencyValue: t.frequencyValue, scheduleType: t.scheduleType, lastCompleted: t.lastCompleted ? new Date(t.lastCompleted).toISOString() : null, nextDue: t.nextDue ? new Date(t.nextDue).toISOString() : null })),
    ...tasksDueSoon.map((t) => ({ id: `s-${t.id}`, title: t.title, type: "task" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, priority: t.priority, status: "due-soon" as const, dateLabel: t.dueDate ? formatDate(t.dueDate) : "", projectId: t.projectId, notes: t.notes, label: t.label, dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null, taskStatus: t.status })),
    ...recurringDueSoon.map((t) => ({ id: `rs-${t.id}`, title: t.title, type: "recurring" as const, owner: `${t.owner.firstName} ${t.owner.lastName}`, ownerId: t.ownerId, status: "due-soon" as const, dateLabel: t.nextDue ? formatDate(t.nextDue) : "", description: t.description, category: t.category, frequencyType: t.frequencyType, frequencyValue: t.frequencyValue, scheduleType: t.scheduleType, lastCompleted: t.lastCompleted ? new Date(t.lastCompleted).toISOString() : null, nextDue: t.nextDue ? new Date(t.nextDue).toISOString() : null })),
  ];

  return (
    <div>
      {/* ── Header + Status Chips ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Operations overview</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!viewAll ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              Mine
            </Link>
            <Link
              href="/?view=all"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewAll ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              All
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip count={totalOverdue} label="Overdue" color="red" href="/tasks" />
          <StatusChip count={totalDueToday} label="Due Today" color="orange" href="/tasks" />
          <StatusChip count={totalDueSoon} label="This Week" color="yellow" href="/tasks" />
          <StatusChip count={totalRecurringDue} label="Recurring Due" color="blue" href="/tasks" />
          {totalAccredIssues > 0 && <StatusChip count={totalAccredIssues} label="Accred. Issues" color="red" href="/training" />}
          {plantServiceOverdue.length > 0 && <StatusChip count={plantServiceOverdue.length} label="Plant Overdue" color="red" href="/plant" />}
        </div>
      </div>

      {/* ── Task Command Centre (primary) + Activity sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        {/* Task centre — 3/4 (client component with complete + edit) */}
        <DashboardTaskCentre tasks={allTaskItems} employees={employeesList} viewAll={viewAll} />

        {/* Recent Activity — sidebar 1/4 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/activity-log" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">View all</Link>
          </div>
          <div className="px-4 py-3 max-h-[480px] overflow-y-auto flex-1">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex gap-2.5 items-start">
                    <ActionDot action={entry.action} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate leading-snug">{entry.entityLabel}</p>
                      <p className="text-xs text-gray-400 leading-snug mt-0.5">
                        {formatRelativeTime(entry.performedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Secondary: Resources row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard label="Employees" value={activeEmployees} sub={`${totalEmployees} total`} href="/employees" />
        <MiniCard label="Assets" value={totalAssets} sub={`${unassignedAssets} unassigned`} href="/assets" />
        <MiniCard label="Plant" value={totalPlant} sub={`${plantStatusMap["OPERATIONAL"] ?? 0} operational`} href="/plant" />
        <MiniCard label="Active Tasks" value={activeTasks} sub={`${highPriorityTasks} high priority`} href="/tasks" />
      </div>
    </div>
  );
}

/* ─── Staff Dashboard ───────────────────────────────── */

async function StaffDashboard({ employeeId }: { employeeId?: string | null }) {
  // Date boundaries in Australian timezone (converted to UTC for Prisma queries)
  const { today, tomorrow: staffTomorrow, sevenDays: sevenDaysFromNow } = getDateBoundaries();

  const [totalAssets, totalPlant, employee, overdueTasks, tasksDueToday, upcomingTasks, overdueRecurring, recurringDueToday, recurringDueSoon] = await Promise.all([
    prisma.asset.count({ where: { isArchived: false } }),
    prisma.plant.count({ where: { isArchived: false } }),
    employeeId
      ? prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            location: true,
            employmentType: true,
            status: true,
            accreditations: {
              include: {
                accreditation: {
                  select: { name: true, accreditationNumber: true, expires: true },
                },
              },
            },
            trainingRoles: {
              include: {
                role: { select: { name: true } },
              },
            },
          },
        })
      : null,
    // Overdue tasks for this employee
    employeeId
      ? prisma.task.findMany({
          where: {
            isArchived: false,
            status: { not: "COMPLETED" },
            dueDate: { lt: today },
            ownerId: employeeId,
          },
          include: { owner: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : [],
    // Tasks due today for this employee
    employeeId
      ? prisma.task.findMany({
          where: {
            isArchived: false,
            status: { not: "COMPLETED" },
            dueDate: { gte: today, lt: staffTomorrow },
            ownerId: employeeId,
          },
          include: { owner: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : [],
    // Tasks due this week (excluding today) for this employee
    employeeId
      ? prisma.task.findMany({
          where: {
            isArchived: false,
            status: { not: "COMPLETED" },
            dueDate: { gte: staffTomorrow, lte: sevenDaysFromNow },
            ownerId: employeeId,
          },
          include: { owner: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : [],
    // Overdue recurring tasks for this employee
    employeeId
      ? prisma.recurringTask.findMany({
          where: {
            isArchived: false,
            nextDue: { lt: today },
            ownerId: employeeId,
          },
          orderBy: { nextDue: "asc" },
          take: 5,
        })
      : [],
    // Recurring tasks due today for this employee
    employeeId
      ? prisma.recurringTask.findMany({
          where: {
            isArchived: false,
            nextDue: { gte: today, lt: staffTomorrow },
            ownerId: employeeId,
          },
          include: { owner: { select: { firstName: true, lastName: true } } },
          orderBy: { nextDue: "asc" },
          take: 5,
        })
      : [],
    // Recurring tasks due this week (excluding today) for this employee
    employeeId
      ? prisma.recurringTask.findMany({
          where: {
            isArchived: false,
            nextDue: { gte: staffTomorrow, lte: sevenDaysFromNow },
            ownerId: employeeId,
          },
          include: { owner: { select: { firstName: true, lastName: true } } },
          orderBy: { nextDue: "asc" },
          take: 5,
        })
      : [],
  ]);

  const pendingCount = employee?.accreditations.filter((a) => a.status === "PENDING").length ?? 0;
  const expiredCount = employee?.accreditations.filter((a) => a.status === "EXPIRED").length ?? 0;
  const staffDueTodayTotal = tasksDueToday.length + recurringDueToday.length;
  const hasTaskAlerts = overdueTasks.length > 0 || overdueRecurring.length > 0 || staffDueTodayTotal > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {employee ? `Welcome, ${employee.firstName}` : "Welcome"}
        </p>
      </div>

      {/* Alerts for own record */}
      {(pendingCount > 0 || expiredCount > 0 || hasTaskAlerts) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {overdueTasks.length > 0 && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""}
            </Link>
          )}
          {overdueRecurring.length > 0 && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {overdueRecurring.length} overdue recurring task{overdueRecurring.length !== 1 ? "s" : ""}
            </Link>
          )}
          {staffDueTodayTotal > 0 && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {staffDueTodayTotal} task{staffDueTodayTotal !== 1 ? "s" : ""} due today
            </Link>
          )}
          {expiredCount > 0 && (
            <Link
              href="/training"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {expiredCount} expired accreditation{expiredCount !== 1 ? "s" : ""}
            </Link>
          )}
          {pendingCount > 0 && (
            <Link
              href="/training"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {pendingCount} pending accreditation{pendingCount !== 1 ? "s" : ""}
            </Link>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="Assets" value={totalAssets} href="/assets" />
        <StatCard label="Plant" value={totalPlant} href="/plant" />
      </div>

      {/* Your Tasks */}
      {employeeId && (
        <div className="mb-5">
          <DashboardCard title="Your Tasks" href="/tasks" linkLabel="View all">
            {overdueTasks.length === 0 && upcomingTasks.length === 0 && overdueRecurring.length === 0 && tasksDueToday.length === 0 && recurringDueToday.length === 0 && recurringDueSoon.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No tasks assigned to you</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Overdue regular tasks */}
                {overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-red-700 truncate block">{task.title}</span>
                      <span className="text-xs text-red-500">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityDot priority={task.priority} />
                      <span className="text-xs font-medium text-red-600 px-1.5 py-0.5 bg-red-50 rounded">Overdue</span>
                    </div>
                  </div>
                ))}
                {/* Overdue recurring tasks */}
                {overdueRecurring.map((task) => (
                  <div key={`r-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-red-700 truncate block">{task.title}</span>
                      <span className="text-xs text-red-500">Recurring &middot; {task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                    <span className="text-xs font-medium text-red-600 px-1.5 py-0.5 bg-red-50 rounded shrink-0 ml-3">Overdue</span>
                  </div>
                ))}
                {/* Tasks due today */}
                {tasksDueToday.map((task) => (
                  <div key={`td-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-orange-700 truncate block">{task.title}</span>
                      <span className="text-xs text-orange-500">{task.owner.firstName} {task.owner.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityDot priority={task.priority} />
                      <span className="text-xs font-medium text-orange-600 px-1.5 py-0.5 bg-orange-50 rounded">Due Today</span>
                    </div>
                  </div>
                ))}
                {/* Recurring tasks due today */}
                {recurringDueToday.map((task) => (
                  <div key={`rt-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-orange-700 truncate block">{task.title}</span>
                      <span className="text-xs text-orange-500">Recurring &middot; {task.owner.firstName} {task.owner.lastName}</span>
                    </div>
                    <span className="text-xs font-medium text-orange-600 px-1.5 py-0.5 bg-orange-50 rounded shrink-0 ml-3">Due Today</span>
                  </div>
                ))}
                {/* Upcoming regular tasks */}
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityDot priority={task.priority} />
                      <span className="text-xs font-medium text-yellow-700 px-1.5 py-0.5 bg-yellow-50 rounded">Due Soon</span>
                      <span className="text-xs text-gray-500 tabular-nums">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                  </div>
                ))}
                {/* Recurring tasks due this week */}
                {recurringDueSoon.map((task) => (
                  <div key={`r-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">Recurring &middot; {task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs font-medium text-yellow-700 px-1.5 py-0.5 bg-yellow-50 rounded">Due Soon</span>
                      <span className="text-xs text-gray-500 tabular-nums">{task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {/* Employee info + training */}
      {employee && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DashboardCard title="Your Details" href={`/employees/${employeeId}`} linkLabel="View">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee #</span>
                <span className="font-medium text-gray-900">{employee.employeeNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-900">{formatEnum(employee.location)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{formatEnum(employee.employmentType)}</span>
              </div>
              {employee.trainingRoles.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Roles</span>
                  <span className="font-medium text-gray-900 text-right">
                    {employee.trainingRoles.map((r) => r.role.name).join(", ")}
                  </span>
                </div>
              )}
            </dl>
          </DashboardCard>

          <DashboardCard title="Your Training" href="/training" linkLabel="View all">
            {employee.accreditations.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No accreditations assigned</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {employee.accreditations.map((ea) => (
                  <div key={ea.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                    <span className="text-sm text-gray-900 truncate">{ea.accreditation.name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ea.status === "VERIFIED" ? "bg-green-50 text-green-700" :
                      ea.status === "EXPIRED" ? "bg-red-50 text-red-700" :
                      ea.status === "PENDING" ? "bg-amber-50 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {ea.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {!employee && (
        <DashboardCard title="Your Details">
          <p className="text-sm text-gray-400 py-2">Your account is not linked to an employee record. Contact your administrator.</p>
        </DashboardCard>
      )}
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────── */

function DashboardCard({ title, href, linkLabel, children }: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-900">{title}</h2>
        {href && linkLabel && (
          <Link href={href} className="text-[10px] text-gray-400 hover:text-blue-600 transition-colors">{linkLabel}</Link>
        )}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function StatusChip({ count, label, color, href }: {
  count: number;
  label: string;
  color: "red" | "orange" | "yellow" | "blue" | "gray";
  href: string;
}) {
  if (count === 0 && color !== "yellow" && color !== "blue") return null;
  const styles: Record<string, string> = {
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const dotStyles: Record<string, string> = {
    red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-500", blue: "bg-blue-500", gray: "bg-gray-400",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors hover:opacity-80 ${styles[color]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[color]}`} />
      <span className="font-bold tabular-nums">{count}</span>
      {label}
    </Link>
  );
}

function StatCard({ label, value, sub, href, accent }: {
  label: string;
  value: number;
  sub?: string;
  href: string;
  accent?: "red";
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm ${
        accent === "red"
          ? "border-red-200 bg-red-50/50 hover:border-red-300"
          : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className={`text-lg font-bold tabular-nums ${accent === "red" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-xs font-medium text-gray-700">{label}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </Link>
  );
}

function MiniCard({ label, value, sub, href }: {
  label: string;
  value: number;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white transition-all hover:shadow-sm hover:border-gray-300"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-gray-900">{value}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </Link>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-red-400",
    MEDIUM: "bg-amber-400",
    LOW: "bg-gray-300",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[priority] ?? "bg-gray-300"}`} />;
}

function ActionDot({ action }: { action: string }) {
  const colors: Record<string, string> = {
    CREATE: "bg-green-400",
    UPDATE: "bg-blue-400",
    ARCHIVE: "bg-gray-400",
    RESTORE: "bg-purple-400",
    COMPLETE: "bg-green-400",
  };
  return (
    <div className="pt-1 shrink-0">
      <span className={`inline-block w-2 h-2 rounded-full ${colors[action] ?? "bg-gray-300"}`} />
    </div>
  );
}

/* ─── Helper Functions ──────────────────────────────── */

function formatEnum(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}
