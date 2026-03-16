"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

const LOCATION_LABELS: Record<string, string> = {
  BRISBANE: "Brisbane",
  BUNDABERG: "Bundaberg",
  HERVEY_BAY: "Hervey Bay",
  MACKAY: "Mackay",
  OTHER: "Other",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-Time",
  TRAINEE: "Trainee",
  CASUAL: "Casual",
  ABN: "ABN",
};

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  roleType: string;
  employmentType: string;
  location: string;
  status: string;
}

const columns: Column<Employee>[] = [
  { key: "employeeNumber", label: "Employee #" },
  {
    key: "name",
    label: "Name",
    render: (item) => `${item.firstName} ${item.lastName}`,
  },
  {
    key: "roleType",
    label: "Role Type",
    render: (item) => item.roleType === "OFFICE" ? "Office" : "Field",
  },
  {
    key: "employmentType",
    label: "Employment",
    render: (item) => EMPLOYMENT_LABELS[item.employmentType] || item.employmentType,
  },
  {
    key: "location",
    label: "Location",
    render: (item) => LOCATION_LABELS[item.location] || item.location,
  },
  {
    key: "status",
    label: "Status",
    render: (item) => <StatusBadge status={item.status} />,
  },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Employee Register"
        description="Manage employee records, roles, and locations."
        action={{ label: "Add Employee", href: "/employees/new" }}
      />
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          linkPrefix="/employees"
          emptyMessage="No employees found. Click 'Add Employee' to create one."
        />
      )}
    </div>
  );
}
