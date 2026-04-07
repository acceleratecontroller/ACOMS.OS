import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { PageHeader } from "@/shared/components/PageHeader";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffAssetsPlantPage() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [assets, plant] = await Promise.all([
    prisma.asset.findMany({
      where: { assignedToId: employeeId, isArchived: false },
      select: {
        id: true,
        assetNumber: true,
        name: true,
        category: true,
        make: true,
        model: true,
        serialNumber: true,
        status: true,
        condition: true,
        expires: true,
        expirationDate: true,
      },
      orderBy: { name: "asc" },
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
        location: true,
        status: true,
        condition: true,
        nextServiceDue: true,
        lastServiceDate: true,
      },
      orderBy: { plantNumber: "asc" },
    }),
  ]);

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="My Assets & Plant"
        description="Equipment and vehicles currently assigned to you."
      />

      {/* Assets Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Assets
          <span className="ml-2 text-sm font-normal text-gray-400">({assets.length})</span>
        </h2>
        {assets.length === 0 ? (
          <p className="text-sm text-gray-400">No assets assigned to you.</p>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-500">Asset</th>
                    <th className="pb-2 font-medium text-gray-500">Number</th>
                    <th className="pb-2 font-medium text-gray-500">Category</th>
                    <th className="pb-2 font-medium text-gray-500">Make / Model</th>
                    <th className="pb-2 font-medium text-gray-500">Condition</th>
                    <th className="pb-2 font-medium text-gray-500">Status</th>
                    <th className="pb-2 font-medium text-gray-500">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const isExpired = asset.expires && asset.expirationDate && new Date(asset.expirationDate) <= now;
                    const isExpiringSoon = asset.expires && asset.expirationDate && !isExpired && new Date(asset.expirationDate) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return (
                    <tr key={asset.id} className="border-b border-gray-100">
                      <td className="py-3 font-medium text-gray-900">{asset.name}</td>
                      <td className="py-3 text-gray-600">{asset.assetNumber}</td>
                      <td className="py-3 text-gray-600">{asset.category}</td>
                      <td className="py-3 text-gray-600">
                        {[asset.make, asset.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-3">{asset.condition ? <StatusBadge status={asset.condition} /> : "—"}</td>
                      <td className="py-3"><StatusBadge status={asset.status} /></td>
                      <td className="py-3">
                        {isExpired ? <StatusBadge status="EXPIRED" /> : isExpiringSoon ? <StatusBadge status="EXPIRING_SOON" /> : asset.expires && asset.expirationDate ? <span className="text-xs text-gray-500">{formatDate(asset.expirationDate)}</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {assets.map((asset) => {
                const isExpired = asset.expires && asset.expirationDate && new Date(asset.expirationDate) <= now;
                const isExpiringSoon = asset.expires && asset.expirationDate && !isExpired && new Date(asset.expirationDate) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                return (
                <div key={asset.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                      <p className="text-xs text-gray-500">{asset.assetNumber} &middot; {asset.category}</p>
                      {(asset.make || asset.model) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[asset.make, asset.model].filter(Boolean).join(" ")}
                        </p>
                      )}
                      {asset.serialNumber && (
                        <p className="text-xs text-gray-400 mt-0.5">S/N: {asset.serialNumber}</p>
                      )}
                      {asset.expires && asset.expirationDate && (
                        <p className={`text-xs mt-0.5 ${isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-orange-600 font-medium" : "text-gray-400"}`}>
                          Expires: {formatDate(asset.expirationDate)}{isExpired ? " (Expired)" : isExpiringSoon ? " (Expiring Soon)" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={asset.status} />
                      {asset.condition && <StatusBadge status={asset.condition} />}
                      {isExpired && <StatusBadge status="EXPIRED" />}
                      {isExpiringSoon && <StatusBadge status="EXPIRING_SOON" />}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Plant Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Plant & Vehicles
          <span className="ml-2 text-sm font-normal text-gray-400">({plant.length})</span>
        </h2>
        {plant.length === 0 ? (
          <p className="text-sm text-gray-400">No plant assigned to you.</p>
        ) : (
          <div className="space-y-4">
            {plant.map((p) => {
              const serviceOverdue = p.nextServiceDue && p.nextServiceDue <= now;
              const serviceSoon = p.nextServiceDue && !serviceOverdue && p.nextServiceDue <= sevenDaysFromNow;
              return (
                <div key={p.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {[p.make, p.model].filter(Boolean).join(" ") || p.category}
                        {p.year ? ` (${p.year})` : ""}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.plantNumber}
                        {p.registrationNumber ? ` — Rego: ${p.registrationNumber}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.category}
                        {p.location ? ` &middot; ${p.location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={p.status} />
                      {p.condition && <StatusBadge status={p.condition} />}
                    </div>
                  </div>

                  {/* Service Info */}
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <p className="text-gray-500">Last Service</p>
                      <p className="font-medium text-gray-700">{formatDate(p.lastServiceDate)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Next Service Due</p>
                      <p className={`font-medium ${
                        serviceOverdue ? "text-red-700" :
                        serviceSoon ? "text-yellow-700" :
                        "text-gray-700"
                      }`}>
                        {formatDate(p.nextServiceDue)}
                        {serviceOverdue && " (Overdue)"}
                        {serviceSoon && " (Due Soon)"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
