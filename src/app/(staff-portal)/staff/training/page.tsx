import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { PageHeader } from "@/shared/components/PageHeader";
import { redirect } from "next/navigation";

export default async function StaffTrainingPage() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [roles, accreditations] = await Promise.all([
    prisma.employeeRole.findMany({
      where: { employeeId },
      select: {
        id: true,
        assignedAt: true,
        role: {
          select: {
            roleNumber: true,
            name: true,
            category: true,
            description: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.employeeAccreditation.findMany({
      where: { employeeId },
      select: {
        id: true,
        status: true,
        issueDate: true,
        expiryDate: true,
        certificateNumber: true,
        notes: true,
        evidenceFileName: true,
        accreditation: {
          select: {
            accreditationNumber: true,
            code: true,
            name: true,
            expires: true,
            renewalMonths: true,
          },
        },
      },
      orderBy: { accreditationId: "asc" },
    }),
  ]);

  const formatDate = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

  // Determine effective status for display
  function getEffectiveStatus(a: typeof accreditations[0]): string {
    if (a.status === "EXPIRED") return "EXPIRED";
    if (a.status === "PENDING") return "PENDING";
    if (a.status === "EXEMPT") return "EXEMPT";
    if (a.status === "VERIFIED" && a.accreditation.expires && a.expiryDate) {
      const expiry = new Date(a.expiryDate);
      if (expiry <= now) return "EXPIRED";
      if (expiry <= ninetyDaysFromNow) return "EXPIRING_SOON";
    }
    return "VERIFIED";
  }

  // Compute summary
  let expired = 0, expiringSoon = 0, current = 0, pending = 0;
  for (const a of accreditations) {
    const eff = getEffectiveStatus(a);
    if (eff === "EXPIRED") expired++;
    else if (eff === "EXPIRING_SOON") expiringSoon++;
    else if (eff === "PENDING") pending++;
    else current++;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="My Training"
        description="Your training roles and accreditation status. Contact your manager to update records."
      />

      {/* Compliance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-3xl font-bold text-green-700">{current}</p>
          <p className="text-sm text-green-600">Current</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <p className="text-3xl font-bold text-yellow-700">{expiringSoon}</p>
          <p className="text-sm text-yellow-600">Expiring Soon</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-3xl font-bold text-red-700">{expired}</p>
          <p className="text-sm text-red-600">Expired</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-3xl font-bold text-blue-700">{pending}</p>
          <p className="text-sm text-blue-600">Pending</p>
        </div>
      </div>

      {/* Training Roles */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Training Roles</h2>
        {roles.length === 0 ? (
          <p className="text-sm text-gray-400">No training roles assigned.</p>
        ) : (
          <div className="space-y-3">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.role.name}</p>
                  {r.role.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{r.role.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.role.roleNumber} &middot; Assigned {formatDate(r.assignedAt)}
                  </p>
                </div>
                <StatusBadge status={r.role.category} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accreditations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accreditations</h2>
        {accreditations.length === 0 ? (
          <p className="text-sm text-gray-400">No accreditations assigned.</p>
        ) : (
          <div className="space-y-3">
            {accreditations.map((a) => {
              const effectiveStatus = getEffectiveStatus(a);
              return (
                <div key={a.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{a.accreditation.name}</p>
                        <StatusBadge status={effectiveStatus} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.accreditation.accreditationNumber}
                        {a.accreditation.code ? ` — ${a.accreditation.code}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                    <div>
                      <p className="text-gray-500">Issue Date</p>
                      <p className="font-medium text-gray-700">{formatDate(a.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expiry Date</p>
                      <p className={`font-medium ${
                        effectiveStatus === "EXPIRED" ? "text-red-700" :
                        effectiveStatus === "EXPIRING_SOON" ? "text-yellow-700" :
                        "text-gray-700"
                      }`}>
                        {a.accreditation.expires ? formatDate(a.expiryDate) : "Does not expire"}
                      </p>
                    </div>
                    {a.certificateNumber && (
                      <div>
                        <p className="text-gray-500">Certificate No.</p>
                        <p className="font-medium text-gray-700">{a.certificateNumber}</p>
                      </div>
                    )}
                    {a.evidenceFileName && (
                      <div>
                        <p className="text-gray-500">Evidence</p>
                        <p className="font-medium text-gray-700">{a.evidenceFileName}</p>
                      </div>
                    )}
                  </div>

                  {a.notes && (
                    <p className="text-xs text-gray-500 mt-2">{a.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evidence Upload Placeholder */}
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-lg font-bold">
            U
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Upload Training Evidence</h3>
          <p className="text-xs text-gray-400 mt-1">
            Certificate upload functionality is coming soon. For now, please provide certificates to your manager.
          </p>
        </div>
      </div>
    </div>
  );
}
