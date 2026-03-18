import Link from "next/link";
import { prisma } from "@/shared/database/client";

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let taskStats = { activeCount: 0, overdueCount: 0, overdueRecurringCount: 0 };
  try {
    const [activeCount, overdueCount, overdueRecurringCount] = await Promise.all([
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
      prisma.recurringTask.count({
        where: { isArchived: false, nextDue: { lt: today } },
      }),
    ]);
    taskStats = { activeCount, overdueCount, overdueRecurringCount };
  } catch {
    // Tables may not exist yet if migration hasn't run
  }

  const totalOverdue = taskStats.overdueCount + taskStats.overdueRecurringCount;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">
        Welcome to ACOMS.OS — your central operations platform.
      </p>

      {/* Task Summary */}
      {(taskStats.activeCount > 0 || totalOverdue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link
            href="/tasks"
            className="block p-4 bg-white rounded border hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="text-2xl font-bold text-gray-900">{taskStats.activeCount}</div>
            <div className="text-sm text-gray-500">Active Tasks</div>
          </Link>
          <Link
            href="/tasks"
            className={`block p-4 rounded border hover:shadow-sm transition-all ${
              taskStats.overdueCount > 0
                ? "bg-red-50 border-red-200 hover:border-red-400"
                : "bg-white hover:border-blue-400"
            }`}
          >
            <div className={`text-2xl font-bold ${taskStats.overdueCount > 0 ? "text-red-600" : "text-gray-900"}`}>
              {taskStats.overdueCount}
            </div>
            <div className="text-sm text-gray-500">Overdue Tasks</div>
          </Link>
          <Link
            href="/tasks"
            className={`block p-4 rounded border hover:shadow-sm transition-all ${
              taskStats.overdueRecurringCount > 0
                ? "bg-red-50 border-red-200 hover:border-red-400"
                : "bg-white hover:border-blue-400"
            }`}
          >
            <div className={`text-2xl font-bold ${taskStats.overdueRecurringCount > 0 ? "text-red-600" : "text-gray-900"}`}>
              {taskStats.overdueRecurringCount}
            </div>
            <div className="text-sm text-gray-500">Overdue Recurring</div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard
          title="Employee Register"
          description="Manage employee records, positions, and departments."
          href="/employees"
        />
        <DashboardCard
          title="Asset Register"
          description="Track tools, phones, laptops, PPE, and other portable items."
          href="/assets"
        />
        <DashboardCard
          title="Plant Register"
          description="Manage cars, trucks, excavators, and heavy equipment."
          href="/plant"
        />
        <DashboardCard
          title="Task Manager"
          description="Track quick tasks and recurring schedules."
          href="/tasks"
        />
      </div>

      <div className="mt-8 p-4 bg-white rounded border text-sm text-gray-500">
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

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-5 bg-white rounded border hover:border-blue-400 hover:shadow-sm transition-all"
    >
      <h2 className="font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
