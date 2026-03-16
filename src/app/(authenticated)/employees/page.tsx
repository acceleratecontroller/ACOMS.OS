"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";

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

const LOCATION_OPTIONS = [
  { value: "BRISBANE", label: "Brisbane" },
  { value: "BUNDABERG", label: "Bundaberg" },
  { value: "HERVEY_BAY", label: "Hervey Bay" },
  { value: "MACKAY", label: "Mackay" },
  { value: "OTHER", label: "Other" },
];

const ROLE_TYPE_OPTIONS = [
  { value: "OFFICE", label: "Office" },
  { value: "FIELD", label: "Field" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "FULL_TIME", label: "Full-Time" },
  { value: "TRAINEE", label: "Trainee" },
  { value: "CASUAL", label: "Casual" },
  { value: "ABN", label: "ABN" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TERMINATED", label: "Terminated" },
];

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleType: string;
  employmentType: string;
  location: string;
  startDate: string;
  endDate: string | null;
  probationDate: string | null;
  status: string;
  notes: string | null;
  isArchived: boolean;
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
    render: (item) => (item.roleType === "OFFICE" ? "Office" : "Field"),
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

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone"),
      roleType: form.get("roleType"),
      employmentType: form.get("employmentType"),
      location: form.get("location"),
      startDate: form.get("startDate"),
      probationDate: form.get("probationDate"),
      status: form.get("status"),
      notes: form.get("notes"),
    };

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      closeModal();
      loadEmployees();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create employee.");
    }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone"),
      roleType: form.get("roleType"),
      employmentType: form.get("employmentType"),
      location: form.get("location"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      probationDate: form.get("probationDate"),
      status: form.get("status"),
      notes: form.get("notes"),
    };

    const res = await fetch(`/api/employees/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      setEditing(false);
      loadEmployees();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update.");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!selected) return;
    if (!confirm("Are you sure you want to archive this employee?")) return;

    const res = await fetch(`/api/employees/${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      closeModal();
      loadEmployees();
    }
  }

  return (
    <div>
      <PageHeader
        title="Employee Register"
        description="Manage employee records, roles, and locations."
      />
      <div className="mb-4">
        <button
          onClick={() => setCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Employee
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          onRowClick={(emp) => { setSelected(emp); setEditing(false); }}
          emptyMessage="No employees found. Click '+ Add Employee' to create one."
        />
      )}

      {/* View / Edit Modal */}
      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {selected.firstName} {selected.lastName}
              </h2>
              <StatusBadge status={selected.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Employee #</dt><dd className="font-medium text-gray-900">{selected.employeeNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Role Type</dt><dd className="font-medium text-gray-900">{selected.roleType === "OFFICE" ? "Office" : "Field"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Employment Type</dt><dd className="font-medium text-gray-900">{EMPLOYMENT_LABELS[selected.employmentType]}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Location</dt><dd className="font-medium text-gray-900">{LOCATION_LABELS[selected.location]}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Email</dt><dd className="font-medium text-gray-900">{selected.email || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Phone</dt><dd className="font-medium text-gray-900">{selected.phone || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Start Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.startDate)}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">End Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.endDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Probation Review</dt><dd className="font-medium text-gray-900">{formatDate(selected.probationDate) || "—"}</dd></div>
            </dl>
            {selected.notes && (
              <div className="mt-5 text-sm">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</p>
                <p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
            <div className="flex gap-3 mt-6 pt-5 border-t">
              <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Edit</button>
              <button onClick={handleArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">Archive</button>
            </div>
          </div>
        )}

        {selected && editing && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Edit Employee</h2>
            <p className="text-sm text-gray-500 mb-5">Employee # {selected.employeeNumber}</p>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" name="firstName" required defaultValue={selected.firstName} />
                <FormField label="Last Name" name="lastName" required defaultValue={selected.lastName} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" name="email" type="email" defaultValue={selected.email || ""} />
                <FormField label="Phone" name="phone" defaultValue={selected.phone || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Role Type" name="roleType" required defaultValue={selected.roleType} options={ROLE_TYPE_OPTIONS} />
                <SelectField label="Employment Type" name="employmentType" required defaultValue={selected.employmentType} options={EMPLOYMENT_TYPE_OPTIONS} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SelectField label="Location" name="location" required defaultValue={selected.location} options={LOCATION_OPTIONS} />
                <SelectField label="Status" name="status" required defaultValue={selected.status} options={STATUS_OPTIONS} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date" name="startDate" type="date" required defaultValue={formatDate(selected.startDate)} />
                <FormField label="End Date" name="endDate" type="date" defaultValue={formatDate(selected.endDate)} />
              </div>
              <FormField label="Probation Review Date" name="probationDate" type="date" defaultValue={formatDate(selected.probationDate)} />
              <TextAreaField label="Notes" name="notes" defaultValue={selected.notes || ""} />

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 pt-3">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setError(""); }} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Add Employee</h2>
        <p className="text-sm text-gray-500 mb-5">Employee number will be auto-generated.</p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" name="firstName" required />
            <FormField label="Last Name" name="lastName" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" name="email" type="email" />
            <FormField label="Phone" name="phone" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Role Type" name="roleType" required options={ROLE_TYPE_OPTIONS} />
            <SelectField label="Employment Type" name="employmentType" required options={EMPLOYMENT_TYPE_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Location" name="location" required options={LOCATION_OPTIONS} />
            <SelectField label="Status" name="status" required defaultValue="ACTIVE" options={STATUS_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" name="startDate" type="date" required />
            <FormField label="Probation Review Date" name="probationDate" type="date" />
          </div>
          <TextAreaField label="Notes" name="notes" placeholder="Optional notes..." />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Create Employee"}
            </button>
            <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
