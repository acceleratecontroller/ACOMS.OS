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

  // Build status maps for easy lookup
  const assetStatusMap: Record<string, number> = {};
  for (const g of assetsByStatus) assetStatusMap[g.status] = g._count;

  const plantStatusMap: Record<string, number> = {};
  for (const g of plantByStatus) plantStatusMap[g.status] = g._count;

  const locationMap: Record<string, number> = {};
  for (const g of employeesByLocation) locationMap[g.location] = g._count;

  const typeMap: Record<string, number> = {};
  for (const g of employeesByType) typeMap[g.employmentType] = g._count;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Welcome to ACOMS.OS — your central operations platform.
      </p>

      {/* Alerts Banner */}
      {(totalOverdue > 0 || plantServiceOverdue.length > 0 || totalAccredIssues > 0) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-sm font-semibold text-red-800 mb-2">Attention Required</h2>
          <div className="flex flex-wrap gap-4 text-sm text-red-700">
            {overdueTasks > 0 && (
              <Link href="/tasks" className="underline hover:text-red-900">
                {overdueTasks} overdue task{overdueTasks !== 1 ? "s" : ""}
              </Link>
            )}
            {overdueRecurring > 0 && (
              <Link href="/tasks" className="underline hover:text-red-900">
                {overdueRecurring} overdue recurring task{overdueRecurring !== 1 ? "s" : ""}
              </Link>
            )}
            {plantServiceOverdue.length > 0 && (
              <Link href="/plant" className="underline hover:text-red-900">
                {plantServiceOverdue.length} plant item{plantServiceOverdue.length !== 1 ? "s" : ""} overdue for service
              </Link>
            )}
            {totalAccredIssues > 0 && (
              <Link href="/training" className="underline hover:text-red-900">
                {totalAccredIssues} accreditation issue{totalAccredIssues !== 1 ? "s" : ""} to resolve
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Accreditation issues breakdown */}
      {(expiredAccredEmployees.length > 0 || expiringSoonAccredEmployees.length > 0 || pendingAccredEmployees.length > 0 || missingAccredCount > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {expiredAccredEmployees.length > 0 && (
            <Link href="/training" className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {expiredAccredEmployees.length} expired
            </Link>
          )}
          {expiringSoonAccredEmployees.length > 0 && (
            <Link href="/training" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              {expiringSoonAccredEmployees.length} expiring soon
            </Link>
          )}
          {(missingAccredCount > 0 || pendingAccredEmployees.length > 0) && (
            <Link href="/training" className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
              {missingAccredCount + pendingAccredEmployees.length} missing or pending
            </Link>
          )}
        </div>
      )}

      {/* Top-level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Employees"
          value={activeEmployees}
          sub={`${totalEmployees} total`}
          href="/employees"
        />
        <StatCard
          label="Assets"
          value={totalAssets}
          sub={`${unassignedAssets} unassigned`}
          href="/assets"
        />
        <StatCard
          label="Plant"
          value={totalPlant}
          sub={`${plantStatusMap["OPERATIONAL"] ?? 0} operational`}
          href="/plant"
        />
        <StatCard
          label="Active Tasks"
          value={activeTasks}
          sub={`${highPriorityTasks} high priority`}
          href="/tasks"
          highlight={overdueTasks > 0}
        />
      </div>

      {/* Two-column detail section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Employee Breakdown */}
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Employees by Location</h2>
            <Link href="/employees" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {Object.keys(locationMap).length === 0 ? (
            <p className="text-sm text-gray-400">No active employees</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(locationMap)
                .sort(([, a], [, b]) => b - a)
                .map(([loc, count]) => (
                  <div key={loc} className="flex justify-between text-sm">
                    <span className="text-gray-600">{formatEnum(loc)}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          )}
          {Object.keys(typeMap).length > 0 && (
            <>
              <hr className="my-3" />
              <h3 className="text-xs font-medium text-gray-500 mb-2">By Employment Type</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(typeMap)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span key={type} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {formatEnum(type)}: {count}
                    </span>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Asset & Plant Status */}
        <div className="bg-white border rounded p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Asset & Plant Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Assets</h3>
              {Object.keys(assetStatusMap).length === 0 ? (
                <p className="text-sm text-gray-400">No assets</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(assetStatusMap).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <StatusDot status={status} />
                        {formatEnum(status)}
                      </span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Plant</h3>
              {Object.keys(plantStatusMap).length === 0 ? (
                <p className="text-sm text-gray-400">No plant</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(plantStatusMap).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <StatusDot status={status} />
                        {formatEnum(status)}
                      </span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Plant service alerts */}
          {(plantServiceOverdue.length > 0 || plantServiceSoon.length > 0) && (
            <>
              <hr className="my-3" />
              <h3 className="text-xs font-medium text-gray-500 mb-2">Service Schedule</h3>
              <div className="space-y-1">
                {plantServiceOverdue.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-red-600">{p.plantNumber}{p.make || p.model ? ` — ${[p.make, p.model].filter(Boolean).join(" ")}` : ""}</span>
                    <span className="text-xs text-red-500">
                      Overdue {formatDate(p.nextServiceDue)}
                    </span>
                  </div>
                ))}
                {plantServiceSoon.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{p.plantNumber}{p.make || p.model ? ` — ${[p.make, p.model].filter(Boolean).join(" ")}` : ""}</span>
                    <span className="text-xs text-amber-600">
                      Due {formatDate(p.nextServiceDue)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tasks Due Soon */}
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Tasks Due This Week</h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {tasksDueSoon.length === 0 ? (
            <p className="text-sm text-gray-400">No tasks due in the next 7 days</p>
          ) : (
            <div className="space-y-2">
              {tasksDueSoon.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="text-gray-900 font-medium truncate block">{task.title}</span>
                    <span className="text-xs text-gray-500">
                      {task.owner.firstName} {task.owner.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <PriorityBadge priority={task.priority} />
                    <span className="text-xs text-gray-500">
                      {task.dueDate ? formatDate(task.dueDate) : "No date"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/activity-log" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <ActionBadge action={entry.action} />
                    <span className="text-gray-900 font-medium truncate">{entry.entityLabel}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {entry.performedBy.name} &middot; {formatRelativeTime(entry.performedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickLink title="Employees" href="/employees" count={totalEmployees} />
        <QuickLink title="Assets" href="/assets" count={totalAssets} />
        <QuickLink title="Plant" href="/plant" count={totalPlant} />
        <QuickLink title="Tasks" href="/tasks" count={activeTasks} />
      </div>

      <div className="p-4 bg-white rounded border text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-2">Coming later:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>WIP Tracker</li>
          <li>Job Creation</li>
          <li>Corrective Actions Register</li>
          <li>File / Document Attachments</li>
          <li>Reporting and Dashboards</li>
        </ul>
      </div>
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  href,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block p-4 rounded border hover:shadow-sm transition-all ${
        highlight
          ? "bg-red-50 border-red-200 hover:border-red-400"
          : "bg-white hover:border-blue-400"
      }`}
    >
      <div className={`text-2xl font-bold ${highlight ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-sm text-gray-700 font-medium">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Link>
  );
}

function QuickLink({ title, href, count }: { title: string; href: string; count: number }) {
  return (
    <Link
      href={href}
      className="block p-3 bg-white rounded border hover:border-blue-400 hover:shadow-sm transition-all text-center"
    >
      <div className="text-lg font-bold text-gray-900">{count}</div>
      <div className="text-xs text-gray-500">{title}</div>
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
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-gray-300"}`} />
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[priority] ?? "bg-gray-100 text-gray-600"}`}>
      {priority}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    ARCHIVE: "bg-gray-100 text-gray-600",
    RESTORE: "bg-purple-100 text-purple-700",
    COMPLETE: "bg-green-100 text-green-700",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles[action] ?? "bg-gray-100 text-gray-600"}`}>
      {action}
    </span>
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
