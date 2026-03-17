"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, SelectField, TextAreaField, ClearableDateField } from "@/shared/components/FormField";
import { AddressAutocomplete } from "@/shared/components/AddressAutocomplete";

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

const SHIRT_SIZE_OPTIONS = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "2XL", label: "2XL" },
  { value: "3XL", label: "3XL" },
  { value: "4XL", label: "4XL" },
  { value: "5XL", label: "5XL" },
];

const PANTS_SIZE_OPTIONS = [
  { value: "28", label: "28" },
  { value: "30", label: "30" },
  { value: "32", label: "32" },
  { value: "34", label: "34" },
  { value: "36", label: "36" },
  { value: "38", label: "38" },
  { value: "40", label: "40" },
  { value: "42", label: "42" },
  { value: "44", label: "44" },
];

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  personalEmail: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
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
    hideOnMobile: true,
  },
  {
    key: "employmentType",
    label: "Employment",
    render: (item) => EMPLOYMENT_LABELS[item.employmentType] || item.employmentType,
    hideOnMobile: true,
  },
  {
    key: "phone",
    label: "Phone",
    render: (item) => item.phone || "—",
    mobileIcon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    key: "location",
    label: "Location",
    render: (item) => LOCATION_LABELS[item.location] || item.location,
    mobileIcon: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (item) => <StatusBadge status={item.status} />,
  },
];

/** Auto-determine status based on end date. Returns the correct status value to save. */
function resolveStatus(endDate: string | null, currentStatus: string): string {
  if (endDate) {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end <= today) return "TERMINATED";
  }
  // If end date was cleared and status is still TERMINATED, revert to ACTIVE
  if (!endDate && currentStatus === "TERMINATED") return "ACTIVE";
  return currentStatus;
}

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

export default function EmployeesPage() {
  return <Suspense><EmployeesContent /></Suspense>;
}

function EmployeesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);
  // Open a specific record if ?open=id is in the URL (from global search)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      router.replace(window.location.pathname, { scroll: false });

      fetch(`/api/employees/${openId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setSelected(data); });
    }
  }, [searchParams, router]);

  const loadEmployees = useCallback((archived: boolean) => {
    setLoading(true);
    const url = archived ? "/api/employees?archived=true" : "/api/employees";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadEmployees(showArchived); }, [loadEmployees, showArchived]);

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
    const endDate = (form.get("endDate") as string) || "";
    const probationDate = (form.get("probationDate") as string) || "";
    const status = resolveStatus(endDate || null, (form.get("status") as string) || "ACTIVE");
    const body = {
      firstName: (form.get("firstName") as string) || "",
      lastName: (form.get("lastName") as string) || "",
      email: (form.get("email") as string) || "",
      personalEmail: (form.get("personalEmail") as string) || "",
      phone: (form.get("phone") as string) || "",
      address: (form.get("address") as string) || "",
      dateOfBirth: (form.get("dateOfBirth") as string) || null,
      shirtSize: (form.get("shirtSize") as string) || "",
      pantsSize: (form.get("pantsSize") as string) || "",
      roleType: (form.get("roleType") as string) || "",
      employmentType: (form.get("employmentType") as string) || "",
      location: (form.get("location") as string) || "",
      startDate: (form.get("startDate") as string) || "",
      endDate: endDate || null,
      probationDate: probationDate || null,
      status,
      notes: (form.get("notes") as string) || "",
    };

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      closeModal();
      loadEmployees(showArchived);
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
    const endDate = (form.get("endDate") as string) || "";
    const probationDate = (form.get("probationDate") as string) || "";
    const formStatus = (form.get("status") as string) || "ACTIVE";
    const status = resolveStatus(endDate || null, formStatus);
    const body = {
      firstName: (form.get("firstName") as string) || "",
      lastName: (form.get("lastName") as string) || "",
      email: (form.get("email") as string) || "",
      personalEmail: (form.get("personalEmail") as string) || "",
      phone: (form.get("phone") as string) || "",
      address: (form.get("address") as string) || "",
      dateOfBirth: (form.get("dateOfBirth") as string) || null,
      shirtSize: (form.get("shirtSize") as string) || "",
      pantsSize: (form.get("pantsSize") as string) || "",
      roleType: (form.get("roleType") as string) || "",
      employmentType: (form.get("employmentType") as string) || "",
      location: (form.get("location") as string) || "",
      startDate: (form.get("startDate") as string) || "",
      endDate: endDate || null,
      probationDate: probationDate || null,
      status,
      notes: (form.get("notes") as string) || "",
    };

    const res = await fetch(`/api/employees/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      closeModal();
      loadEmployees(showArchived);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update.");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!selected) return;
    const res = await fetch(`/api/employees/${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmAction(null);
      closeModal();
      loadEmployees(showArchived);
    }
  }

  async function handleRestore() {
    if (!selected) return;
    const res = await fetch(`/api/employees/${selected.id}/restore`, { method: "POST" });
    if (res.ok) {
      setConfirmAction(null);
      closeModal();
      loadEmployees(showArchived);
    }
  }

  return (
    <div>
      <PageHeader
        title="Employee Register"
        description="Manage employee records, roles, and locations."
      />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showArchived
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showArchived
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Archived
          </button>
        </div>
        {!showArchived && (
          <button
            onClick={() => setCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Employee
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          onRowClick={(emp) => { setSelected(emp); setEditing(false); }}
          emptyMessage={showArchived ? "No archived employees." : "No employees found. Click '+ Add Employee' to create one."}
        />
      )}

      {/* View / Edit Modal */}
      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                {selected.firstName} {selected.lastName}
              </h2>
              <StatusBadge status={selected.status} />
              {selected.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Archived</span>
              )}
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 md:gap-y-5 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Employee #</dt><dd className="font-medium text-gray-900">{selected.employeeNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Role Type</dt><dd className="font-medium text-gray-900">{selected.roleType === "OFFICE" ? "Office" : "Field"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Employment Type</dt><dd className="font-medium text-gray-900">{EMPLOYMENT_LABELS[selected.employmentType]}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Location</dt><dd className="font-medium text-gray-900">{LOCATION_LABELS[selected.location]}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Work Email</dt><dd className="font-medium text-gray-900">{selected.email || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Personal Email</dt><dd className="font-medium text-gray-900">{selected.personalEmail || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Phone</dt><dd className="font-medium text-gray-900">{selected.phone || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Date of Birth</dt><dd className="font-medium text-gray-900">{formatDate(selected.dateOfBirth) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Start Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.startDate)}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">End Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.endDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Probation Review</dt><dd className="font-medium text-gray-900">{formatDate(selected.probationDate) || "—"}</dd></div>
              <div className="md:col-span-3"><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Address</dt><dd className="font-medium text-gray-900">{selected.address || "—"}</dd></div>
            </dl>
            <div className="mt-4 inline-flex items-center gap-4 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Uniform</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">{selected.shirtSize || "—"}</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
                <span className="text-sm font-medium text-gray-900">{selected.pantsSize || "—"}</span>
              </div>
            </div>
            {selected.notes && (
              <div className="mt-5 text-sm">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</p>
                <p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
            <div className="flex gap-3 mt-6 pt-5 border-t">
              {selected.isArchived ? (
                <button onClick={() => setConfirmAction({ type: "restore" })} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Restore</button>
              ) : (
                <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Edit</button>
              )}
            </div>
          </div>
        )}

        {selected && editing && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Edit Employee</h2>
            <p className="text-sm text-gray-500 mb-5">Employee # {selected.employeeNumber}</p>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="First Name" name="firstName" required defaultValue={selected.firstName} />
                <FormField label="Last Name" name="lastName" required defaultValue={selected.lastName} />
                <FormField label="Phone" name="phone" defaultValue={selected.phone || ""} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Work Email" name="email" type="email" defaultValue={selected.email || ""} />
                <FormField label="Personal Email" name="personalEmail" type="email" defaultValue={selected.personalEmail || ""} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Date of Birth" name="dateOfBirth" type="date" defaultValue={formatDate(selected.dateOfBirth)} />
                <div className="md:col-span-2">
                  <AddressAutocomplete label="Address" name="address" defaultValue={selected.address || ""} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SelectField label="Role Type" name="roleType" required defaultValue={selected.roleType} options={ROLE_TYPE_OPTIONS} />
                <SelectField label="Employment Type" name="employmentType" required defaultValue={selected.employmentType} options={EMPLOYMENT_TYPE_OPTIONS} />
                <SelectField label="Location" name="location" required defaultValue={selected.location} options={LOCATION_OPTIONS} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Start Date" name="startDate" type="date" required defaultValue={formatDate(selected.startDate)} />
                <ClearableDateField label="End Date" name="endDate" defaultValue={formatDate(selected.endDate)} />
                <ClearableDateField label="Probation Review Date" name="probationDate" defaultValue={formatDate(selected.probationDate)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SelectField label="Status" name="status" required defaultValue={selected.status} options={STATUS_OPTIONS} />
              </div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Uniform Size</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                      Shirt
                    </label>
                    <select name="shirtSize" defaultValue={selected.shirtSize || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select...</option>
                      {SHIRT_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
                      Pants
                    </label>
                    <select name="pantsSize" defaultValue={selected.pantsSize || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select...</option>
                      {PANTS_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <TextAreaField label="Notes" name="notes" defaultValue={selected.notes || ""} rows={2} />

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 pt-3">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <div className="flex-1" />
                <button type="button" onClick={() => setConfirmAction({ type: "archive" })} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">
                  Archive
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
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="First Name" name="firstName" required />
            <FormField label="Last Name" name="lastName" required />
            <FormField label="Phone" name="phone" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Work Email" name="email" type="email" />
            <FormField label="Personal Email" name="personalEmail" type="email" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Date of Birth" name="dateOfBirth" type="date" />
            <div className="md:col-span-2">
              <AddressAutocomplete label="Address" name="address" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField label="Role Type" name="roleType" required options={ROLE_TYPE_OPTIONS} />
            <SelectField label="Employment Type" name="employmentType" required options={EMPLOYMENT_TYPE_OPTIONS} />
            <SelectField label="Location" name="location" required options={LOCATION_OPTIONS} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Start Date" name="startDate" type="date" required />
            <ClearableDateField label="Probation Review Date" name="probationDate" />
            <SelectField label="Status" name="status" required defaultValue="ACTIVE" options={STATUS_OPTIONS} />
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Uniform Size</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                  Shirt
                </label>
                <select name="shirtSize" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select...</option>
                  {SHIRT_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
                  Pants
                </label>
                <select name="pantsSize" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Select...</option>
                  {PANTS_SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <TextAreaField label="Notes" name="notes" placeholder="Optional notes..." rows={2} />

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

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === "archive" ? "Archive Employee" : "Restore Employee"}
        message={confirmAction?.type === "archive"
          ? "Are you sure you want to archive this employee? They will be moved to the archived list."
          : "Are you sure you want to restore this employee? They will be moved back to the active list."}
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Restore"}
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={confirmAction?.type === "archive" ? handleArchive : handleRestore}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
