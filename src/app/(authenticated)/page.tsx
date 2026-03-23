import Link from "next/link";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const employeeId = session?.user?.employeeId ?? null;

  // STAFF dashboard — show own info, training status, and read-only asset/plant counts
  if (!isAdmin) {
    return <StaffDashboard employeeId={employeeId} />;
  }

  const params = await searchParams;
  const viewAll = params.view === "all";
  // Filter tasks to logged-in employee unless "all" view is selected
  const taskOwnerFilter = !viewAll && employeeId ? { ownerId: employeeId } : {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

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
    highPriorityTasks,
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
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        priority: "HIGH",
        ...taskOwnerFilter,
      },
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today, lte: sevenDaysFromNow },
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
      include: { performedBy: { select: { name: true } } },
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

  // Collect priority items for the attention strip
  const alerts: { label: string; href: string; color: "red" | "amber" }[] = [];
  if (overdueTasks > 0) alerts.push({ label: `${overdueTasks} overdue task${overdueTasks !== 1 ? "s" : ""}`, href: "/tasks", color: "red" });
  if (overdueRecurring > 0) alerts.push({ label: `${overdueRecurring} overdue recurring`, href: "/tasks", color: "red" });
  if (recurringDueTodayCount > 0) alerts.push({ label: `${recurringDueTodayCount} recurring due today`, href: "/tasks", color: "amber" });
  if (plantServiceOverdue.length > 0) alerts.push({ label: `${plantServiceOverdue.length} plant overdue`, href: "/plant", color: "red" });
  if (totalAccredIssues > 0) alerts.push({ label: `${totalAccredIssues} accreditation issue${totalAccredIssues !== 1 ? "s" : ""}`, href: "/training", color: "red" });
  if (expiringSoonAccredEmployees.length > 0) alerts.push({ label: `${expiringSoonAccredEmployees.length} accred. expiring soon`, href: "/training", color: "amber" });
  if (plantServiceSoon.length > 0) alerts.push({ label: `${plantServiceSoon.length} plant service due`, href: "/plant", color: "amber" });

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Operations overview</p>
      </div>

      {/* ── Priority alerts ── */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {alerts.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                a.color === "red"
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${a.color === "red" ? "bg-red-500" : "bg-amber-500"}`} />
              {a.label}
            </Link>
          ))}
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Employees" value={activeEmployees} sub={`${totalEmployees} total`} href="/employees" />
        <StatCard label="Assets" value={totalAssets} sub={`${unassignedAssets} unassigned`} href="/assets" />
        <StatCard label="Plant" value={totalPlant} sub={`${plantStatusMap["OPERATIONAL"] ?? 0} operational`} href="/plant" />
        <StatCard
          label={viewAll ? "All Tasks" : "My Tasks"}
          value={activeTasks}
          sub={totalOverdue > 0 ? `${totalOverdue} overdue` : `${highPriorityTasks} high priority`}
          href="/tasks"
          accent={totalOverdue > 0 ? "red" : undefined}
        />
      </div>

      {/* ── Main content — 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tasks due this week */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {viewAll ? "All Tasks Due This Week" : "My Tasks Due This Week"}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs">
                  <Link
                    href="/"
                    className={`px-2 py-0.5 rounded transition-colors ${
                      !viewAll
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Mine
                  </Link>
                  <Link
                    href="/?view=all"
                    className={`px-2 py-0.5 rounded transition-colors ${
                      viewAll
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    All
                  </Link>
                </div>
                <Link href="/tasks" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">View all</Link>
              </div>
            </div>
            <div className="px-4 py-3">
            {tasksDueSoon.length === 0 && recurringDueSoon.length === 0 && overdueRecurringTasks.length === 0 && recurringDueToday.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No tasks due in the next 7 days</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Overdue recurring tasks */}
                {overdueRecurringTasks.map((task) => (
                  <div key={`r-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-red-700 truncate block">{task.title}</span>
                      <span className="text-xs text-red-500">Recurring &middot; {task.owner.firstName} {task.owner.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs font-medium text-red-600 px-1.5 py-0.5 bg-red-50 rounded">Overdue</span>
                      <span className="text-xs text-red-500 tabular-nums">{task.nextDue ? formatDate(task.nextDue) : ""}</span>
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
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs font-medium text-orange-600 px-1.5 py-0.5 bg-orange-50 rounded">Due Today</span>
                    </div>
                  </div>
                ))}
                {/* Regular tasks due this week */}
                {tasksDueSoon.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">{task.owner.firstName} {task.owner.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityDot priority={task.priority} />
                      <span className="text-xs text-gray-500 tabular-nums">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                  </div>
                ))}
                {/* Recurring tasks due this week */}
                {recurringDueSoon.map((task) => (
                  <div key={`r-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">Recurring &middot; {task.owner.firstName} {task.owner.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Recurring</span>
                      <span className="text-xs text-gray-500 tabular-nums">{task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* Asset & Plant overview — compact side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DashboardCard title="Assets" href="/assets" linkLabel="Manage">
              {Object.keys(assetStatusMap).length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No assets registered</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(assetStatusMap).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <StatusDot status={status} />
                        {formatEnum(status)}
                      </span>
                      <span className="font-medium text-gray-900 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Plant" href="/plant" linkLabel="Manage">
              {Object.keys(plantStatusMap).length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No plant registered</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(plantStatusMap).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <StatusDot status={status} />
                        {formatEnum(status)}
                      </span>
                      <span className="font-medium text-gray-900 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Plant service inline */}
              {plantServiceOverdue.length > 0 && (
                <>
                  <hr className="my-2.5 border-gray-100" />
                  {plantServiceOverdue.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs py-0.5">
                      <span className="text-red-600 font-medium">{p.plantNumber}</span>
                      <span className="text-red-500">Overdue {formatDate(p.nextServiceDue)}</span>
                    </div>
                  ))}
                </>
              )}
            </DashboardCard>
          </div>

          {/* Employees by location — compact */}
          <DashboardCard title="Employees" href="/employees" linkLabel="View all">
            {Object.keys(locationMap).length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No active employees</p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {Object.entries(locationMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([loc, count]) => (
                    <div key={loc} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">{formatEnum(loc)}</span>
                      <span className="font-medium text-gray-900 tabular-nums">{count}</span>
                    </div>
                  ))}
                {Object.entries(typeMap).length > 0 && (
                  <div className="w-full mt-1.5 flex flex-wrap gap-2">
                    {Object.entries(typeMap)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span key={type} className="text-xs text-gray-500">
                          {formatEnum(type)}: {count}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-5">

          {/* Recent Activity */}
          <DashboardCard title="Recent Activity" href="/activity-log" linkLabel="View all">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex gap-2.5">
                    <ActionDot action={entry.action} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{entry.entityLabel}</p>
                      <p className="text-xs text-gray-400">
                        {entry.performedBy.name} &middot; {formatRelativeTime(entry.performedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

/* ─── Staff Dashboard ───────────────────────────────── */

async function StaffDashboard({ employeeId }: { employeeId?: string | null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const staffTomorrow = new Date(today);
  staffTomorrow.setDate(staffTomorrow.getDate() + 1);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [totalAssets, totalPlant, employee, overdueTasks, upcomingTasks, overdueRecurring, recurringDueToday, recurringDueSoon] = await Promise.all([
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
    // Tasks due this week for this employee
    employeeId
      ? prisma.task.findMany({
          where: {
            isArchived: false,
            status: { not: "COMPLETED" },
            dueDate: { gte: today, lte: sevenDaysFromNow },
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
  const hasTaskAlerts = overdueTasks.length > 0 || overdueRecurring.length > 0 || recurringDueToday.length > 0;

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
          {recurringDueToday.length > 0 && (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {recurringDueToday.length} recurring due today
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
            {overdueTasks.length === 0 && upcomingTasks.length === 0 && overdueRecurring.length === 0 && recurringDueToday.length === 0 && recurringDueSoon.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No tasks assigned to you</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Overdue regular tasks */}
                {overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-red-700 truncate block">{task.title}</span>
                      <span className="text-xs text-red-500">Overdue — {task.dueDate ? formatDate(task.dueDate) : ""}</span>
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
                      <span className="text-xs text-red-500">Recurring — overdue since {task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                    <span className="text-xs font-medium text-red-600 px-1.5 py-0.5 bg-red-50 rounded shrink-0 ml-3">Overdue</span>
                  </div>
                ))}
                {/* Recurring tasks due today */}
                {recurringDueToday.map((task) => (
                  <div key={`rt-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-orange-700 truncate block">{task.title}</span>
                      <span className="text-xs text-orange-500">Recurring — due today</span>
                    </div>
                    <span className="text-xs font-medium text-orange-600 px-1.5 py-0.5 bg-orange-50 rounded shrink-0 ml-3">Due Today</span>
                  </div>
                ))}
                {/* Upcoming regular tasks */}
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">Due {task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityDot priority={task.priority} />
                      <span className="text-xs text-gray-500 tabular-nums">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                    </div>
                  </div>
                ))}
                {/* Recurring tasks due this week */}
                {recurringDueSoon.map((task) => (
                  <div key={`r-${task.id}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{task.title}</span>
                      <span className="text-xs text-gray-500">Recurring — due {task.nextDue ? formatDate(task.nextDue) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Recurring</span>
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {href && linkLabel && (
          <Link href={href} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">{linkLabel}</Link>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
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
      className={`block px-4 py-3 rounded-lg border transition-all hover:shadow-sm ${
        accent === "red"
          ? "border-red-200 bg-red-50/50 hover:border-red-300"
          : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      <div className={`text-2xl font-bold tabular-nums ${accent === "red" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </Link>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    AVAILABLE: "bg-green-400",
    IN_USE: "bg-blue-400",
    MAINTENANCE: "bg-amber-400",
    RETIRED: "bg-gray-400",
    OPERATIONAL: "bg-green-400",
    DECOMMISSIONED: "bg-gray-400",
    STANDBY: "bg-amber-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-gray-300"}`} />;
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
    <div className="pt-1.5 shrink-0">
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
