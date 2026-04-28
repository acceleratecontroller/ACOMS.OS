import Link from "next/link";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Parallel fetch all dashboard data
  const [
    employee,
    assets,
    plant,
    accreditations,
    roles,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeNumber: true,
        employmentType: true,
        location: true,
        status: true,
        email: true,
        phone: true,
      },
    }),
    prisma.asset.findMany({
      where: { assignedToId: employeeId, isArchived: false },
      select: {
        id: true,
        assetNumber: true,
        name: true,
        category: { select: { name: true } },
        status: true,
        condition: true,
      },
      orderBy: { name: "asc" },
      take: 5,
    }),
    prisma.plant.findMany({
      where: { assignedToId: employeeId, isArchived: false },
      select: {
        id: true,
        plantNumber: true,
        category: true,
        registrationNumber: true,
        make: true,
        model: true,
        year: true,
        status: true,
        nextServiceDue: true,
      },
      orderBy: { plantNumber: "asc" },
      take: 5,
    }),
    prisma.employeeAccreditation.findMany({
      where: { employeeId },
      select: {
        id: true,
        status: true,
        expiryDate: true,
        accreditation: {
          select: {
            name: true,
            code: true,
            expires: true,
          },
        },
      },
      orderBy: { accreditation: { name: "asc" } },
    }),
    prisma.employeeRole.findMany({
      where: { employeeId },
      select: {
        role: {
          select: { name: true, category: true },
        },
      },
      orderBy: { role: { name: "asc" } },
    }),
  ]);

  if (!employee) {
    redirect("/login");
  }

  // Compute compliance stats
  let expired = 0;
  let expiringSoon = 0;
  let current = 0;
  let pending = 0;

  for (const a of accreditations) {
    if (a.status === "EXPIRED") {
      expired++;
    } else if (a.status === "PENDING") {
      pending++;
    } else if (
      a.status === "VERIFIED" &&
      a.accreditation.expires &&
      a.expiryDate
    ) {
      if (a.expiryDate <= now) {
        expired++;
      } else if (a.expiryDate <= ninetyDaysFromNow) {
        expiringSoon++;
      } else {
        current++;
      }
    } else if (a.status === "VERIFIED" || a.status === "EXEMPT") {
      current++;
    }
  }

  // Count total assets and plant
  const [totalAssets, totalPlant] = await Promise.all([
    prisma.asset.count({ where: { assignedToId: employeeId, isArchived: false } }),
    prisma.plant.count({ where: { assignedToId: employeeId, isArchived: false } }),
  ]);

  // Determine greeting based on time
  const hour = new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", hour12: false });
  const hourNum = parseInt(hour, 10);
  const greeting = hourNum < 12 ? "Good morning" : hourNum < 17 ? "Good afternoon" : "Good evening";

  // Build notification items
  const notifications: { type: "error" | "warning" | "info"; message: string }[] = [];
  if (expired > 0) {
    notifications.push({ type: "error", message: `${expired} expired accreditation${expired > 1 ? "s" : ""} require attention` });
  }
  if (expiringSoon > 0) {
    notifications.push({ type: "warning", message: `${expiringSoon} accreditation${expiringSoon > 1 ? "s" : ""} expiring within 90 days` });
  }
  for (const p of plant) {
    if (p.nextServiceDue && p.nextServiceDue <= now) {
      notifications.push({ type: "error", message: `${p.plantNumber} — service overdue` });
    } else if (p.nextServiceDue && p.nextServiceDue <= sevenDaysFromNow) {
      notifications.push({ type: "warning", message: `${p.plantNumber} — service due soon` });
    }
  }
  if (pending > 0) {
    notifications.push({ type: "info", message: `${pending} accreditation${pending > 1 ? "s" : ""} pending verification` });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Notifications Banner */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div
              key={i}
              className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                n.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : n.type === "warning"
                  ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              <span>
                {n.type === "error" ? "!" : n.type === "warning" ? "!" : "i"}
              </span>
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Welcome Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {employee.firstName}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {employee.employeeNumber} &middot; {employee.location.replace(/_/g, " ")} &middot; {employee.employmentType.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={employee.status} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/staff/profile"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">P</div>
          <span className="text-sm font-medium text-gray-700">My Profile</span>
        </Link>
        <Link
          href="/staff/training"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 mx-auto mb-2 bg-green-100 text-green-600 rounded-lg flex items-center justify-center font-bold">T</div>
          <span className="text-sm font-medium text-gray-700">My Training</span>
        </Link>
        <Link
          href="/staff/assets-plant"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold">A</div>
          <span className="text-sm font-medium text-gray-700">Assets & Plant</span>
        </Link>
        <Link
          href="/staff/forms"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 text-gray-400 rounded-lg flex items-center justify-center font-bold">F</div>
          <span className="text-sm font-medium text-gray-400">Forms</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Coming Soon</p>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Profile Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Profile</h2>
            <Link href="/staff/profile" className="text-sm text-blue-600 hover:text-blue-800">
              View full profile
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{employee.firstName} {employee.lastName}</p>
            </div>
            <div>
              <p className="text-gray-500">Employee No.</p>
              <p className="font-medium">{employee.employeeNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">Location</p>
              <p className="font-medium">{employee.location.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium">{employee.employmentType.replace(/_/g, " ")}</p>
            </div>
            {employee.email && (
              <div className="col-span-2">
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{employee.email}</p>
              </div>
            )}
            {employee.phone && (
              <div className="col-span-2">
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">{employee.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Training & Compliance Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Training & Compliance</h2>
            <Link href="/staff/training" className="text-sm text-blue-600 hover:text-blue-800">
              View all
            </Link>
          </div>

          {/* Traffic Light Summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-700">{current}</p>
              <p className="text-xs text-green-600">Current</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-700">{expiringSoon}</p>
              <p className="text-xs text-yellow-600">Expiring</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-2xl font-bold text-red-700">{expired}</p>
              <p className="text-xs text-red-600">Expired</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-2xl font-bold text-blue-700">{pending}</p>
              <p className="text-xs text-blue-600">Pending</p>
            </div>
          </div>

          {/* Roles */}
          {roles.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Training Roles</p>
              <div className="flex flex-wrap gap-2">
                {roles.map((r, i) => (
                  <span
                    key={i}
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      r.role.category === "FIELD"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {r.role.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {accreditations.length === 0 && roles.length === 0 && (
            <p className="text-sm text-gray-400">No training assignments yet.</p>
          )}
        </div>

        {/* My Assets Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              My Assets
              <span className="ml-2 text-sm font-normal text-gray-400">({totalAssets})</span>
            </h2>
            {totalAssets > 0 && (
              <Link href="/staff/assets-plant" className="text-sm text-blue-600 hover:text-blue-800">
                View all
              </Link>
            )}
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-gray-400">No assets assigned to you.</p>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                    <p className="text-xs text-gray-500">{asset.assetNumber} &middot; {asset.category.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {asset.condition && <StatusBadge status={asset.condition} />}
                    <StatusBadge status={asset.status} />
                  </div>
                </div>
              ))}
              {totalAssets > 5 && (
                <p className="text-xs text-gray-400 text-center">
                  Showing 5 of {totalAssets} &middot;{" "}
                  <Link href="/staff/assets-plant" className="text-blue-600 hover:text-blue-800">View all</Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* My Plant Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              My Plant
              <span className="ml-2 text-sm font-normal text-gray-400">({totalPlant})</span>
            </h2>
            {totalPlant > 0 && (
              <Link href="/staff/assets-plant" className="text-sm text-blue-600 hover:text-blue-800">
                View all
              </Link>
            )}
          </div>
          {plant.length === 0 ? (
            <p className="text-sm text-gray-400">No plant assigned to you.</p>
          ) : (
            <div className="space-y-3">
              {plant.map((p) => {
                const serviceOverdue = p.nextServiceDue && p.nextServiceDue <= now;
                const serviceSoon = p.nextServiceDue && !serviceOverdue && p.nextServiceDue <= sevenDaysFromNow;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {p.make} {p.model} {p.year ? `(${p.year})` : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.plantNumber}
                        {p.registrationNumber ? ` — ${p.registrationNumber}` : ""}
                        {" "}&middot; {p.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {serviceOverdue && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                          Service Overdue
                        </span>
                      )}
                      {serviceSoon && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Service Due
                        </span>
                      )}
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                );
              })}
              {totalPlant > 5 && (
                <p className="text-xs text-gray-400 text-center">
                  Showing 5 of {totalPlant} &middot;{" "}
                  <Link href="/staff/assets-plant" className="text-blue-600 hover:text-blue-800">View all</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 font-medium">Coming Soon</span>
        </div>
        <p className="text-sm text-gray-400">
          Task management will be available here once integrated with ACOMS.Controller.
          You&apos;ll be able to view and complete tasks assigned to you.
        </p>
      </div>

      {/* Forms & Requests Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Forms & Requests</h2>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 font-medium">Coming Soon</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Leave Request", "Hazard Report", "Equipment Request", "Incident Report"].map((form) => (
            <div
              key={form}
              className="p-4 rounded-lg border border-dashed border-gray-300 text-center opacity-50"
            >
              <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold">
                F
              </div>
              <p className="text-xs text-gray-400">{form}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
