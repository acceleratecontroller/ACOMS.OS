"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string | null;
  status: string;
  email: string | null;
}

const columns: Column<Employee>[] = [
  { key: "employeeNumber", label: "Employee #" },
  {
    key: "name",
    label: "Name",
    render: (item) => `${item.firstName} ${item.lastName}`,
  },
  { key: "position", label: "Position" },
  { key: "department", label: "Department" },
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
        description="Manage employee records, positions, and departments."
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
