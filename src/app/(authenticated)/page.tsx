import Link from "next/link";
import { prisma } from "@/shared/database/client";

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    // Tasks
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
    prisma.task.count({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        priority: "HIGH",
      },
    }),
    prisma.task.findMany({
      where: {
        isArchived: false,
        status: { not: "COMPLETED" },
        dueDate: { gte: today, lte: sevenDaysFromNow },
      },
      include: { owner: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.recurringTask.count({
      where: { isArchived: false, nextDue: { lt: today } },
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
          label="Tasks"
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
          <DashboardCard title="Tasks Due This Week" href="/tasks" linkLabel="View all">
            {tasksDueSoon.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No tasks due in the next 7 days</p>
            ) : (
              <div className="divide-y divide-gray-100">
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
              </div>
            )}
          </DashboardCard>

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
