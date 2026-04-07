const statusColors: Record<string, string> = {
  // Employee statuses
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  TERMINATED: "bg-red-100 text-red-800",

  // Asset statuses
  AVAILABLE: "bg-green-100 text-green-800",
  IN_USE: "bg-blue-100 text-blue-800",
  MAINTENANCE: "bg-yellow-100 text-yellow-800",
  RETIRED: "bg-gray-100 text-gray-800",

  // Plant statuses
  OPERATIONAL: "bg-green-100 text-green-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-800",
  STANDBY: "bg-blue-100 text-blue-800",

  // Accreditation statuses
  PENDING: "bg-yellow-100 text-yellow-800",
  VERIFIED: "bg-green-100 text-green-800",
  EXPIRED: "bg-red-100 text-red-800",
  EXEMPT: "bg-gray-100 text-gray-800",

  // Training role categories
  OFFICE: "bg-blue-100 text-blue-800",
  FIELD: "bg-orange-100 text-orange-800",

  // Compliance statuses
  COMPLIANT: "bg-green-100 text-green-800",
  EXPIRING_SOON: "bg-orange-100 text-orange-800",
  "NON-COMPLIANT": "bg-red-100 text-red-800",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColors[status] || "bg-gray-100 text-gray-800";
  const display = status.replace(/_/g, " ");

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium ${color}`}
    >
      {display}
    </span>
  );
}
