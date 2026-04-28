// ⚠️  IMPORTANT: This page contains a Login Access section (grant/revoke/manage portal roles).
// A duplicate of this section also exists in employees/[id]/page.tsx (detail page).
// If you change the login access UI or logic here, update the detail page too (and vice versa).

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, SelectField, TextAreaField, ClearableDateField } from "@/shared/components/FormField";
import { AddressAutocomplete } from "@/shared/components/AddressAutocomplete";
import { filterByRegion } from "@/shared/components/RegionToggle";
import { useRegionFilter } from "@/shared/context/RegionFilter";
import type { Location } from "@prisma/client";
import {
  LOCATION_OPTIONS,
  LOCATION_LABELS,
  EMPLOYMENT_TYPE_OPTIONS,
  EMPLOYMENT_LABELS,
  EMPLOYEE_STATUS_OPTIONS as STATUS_OPTIONS,
  SHIRT_SIZE_OPTIONS,
  PANTS_SIZE_OPTIONS,
  EMERGENCY_RELATION_OPTIONS,
  EMERGENCY_RELATION_LABELS,
} from "@/config/constants";

interface TrainingRoleRef {
  id: string;
  name: string;
  roleNumber: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  identityId: string | null;
  email: string | null;
  personalEmail: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  shirtSize: string | null;
  pantsSize: string | null;
  employmentType: string;
  location: Location;
  startDate: string;
  endDate: string | null;
  probationDate: string | null;
  status: string;
  notes: string | null;
  emergencyFirstName: string | null;
  emergencyLastName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  emergencyPhoneAlt: string | null;
  isArchived: boolean;
  trainingRoles: { role: TrainingRoleRef }[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string | null;
  updatedByName?: string | null;
}

const columns: Column<Employee>[] = [
  { key: "employeeNumber", label: "Employee #" },
  {
    key: "name",
    label: "Name",
    render: (item) => `${item.firstName} ${item.lastName}`,
  },
  {
    key: "roles",
    label: "Roles",
    render: (item) =>
      item.trainingRoles.length > 0
        ? item.trainingRoles.map((r) => r.role.name).join(", ")
        : "—",
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
    render: (item) => formatPhone(item.phone) || "—",
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

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("04") && digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export default function EmployeesPage() {
  return <Suspense><EmployeesContent /></Suspense>;
}

interface AccessInfo {
  identityId: string;
  email: string;
}

function EmployeesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const isAdmin = session.data?.user?.role === "ADMIN";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { selectedRegions } = useRegionFilter();
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);
  const [trainingRoles, setTrainingRoles] = useState<TrainingRoleRef[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Login access state
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [portals, setPortals] = useState<{ clientId: string; name: string; isActive: boolean }[]>([]);
  const [portalRoles, setPortalRoles] = useState<{ clientId: string; role: string; enabled: boolean }[]>([]);
  const [identityRoles, setIdentityRoles] = useState<{ clientId: string; portalName: string; role: string }[]>([]);
  const [showManageRoles, setShowManageRoles] = useState(false);
  // Open a specific record if ?open=id is in the URL (from global search)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      router.replace(window.location.pathname, { scroll: false });

      fetch(`/api/employees/${openId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) selectEmployee(data); });
    }
  }, [searchParams, router]);

  // Load training roles for the multi-select
  useEffect(() => {
    fetch("/api/training/roles")
      .then((r) => r.ok ? r.json() : [])
      .then((data: TrainingRoleRef[]) => setTrainingRoles(data));
  }, []);

  // Load portals from Auth for access management
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/portals")
      .then((r) => r.ok ? r.json() : { portals: [] })
      .then((data: { portals: { clientId: string; name: string; isActive: boolean }[] }) => {
        const activePortals = (data.portals || []).filter((p) => p.isActive);
        setPortals(activePortals);
        setPortalRoles(activePortals.map((p) => ({ clientId: p.clientId, role: "STAFF", enabled: false })));
      });
  }, [isAdmin]);

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

  function selectEmployee(emp: Employee) {
    setSelected(emp);
    setEditing(false);
    setShowGrantForm(false);
    setShowManageRoles(false);
    setAccessError("");
    setIdentityRoles([]);
    // Fetch portal roles if employee has access
    if (emp.identityId && isAdmin) {
      fetch(`/api/employees/${emp.id}/access`)
        .then((r) => r.ok ? r.json() : { roles: [] })
        .then((data: { roles: { clientId: string; portalName: string; role: string }[] }) => {
          const roles = data.roles || [];
          setIdentityRoles(roles);
          setPortalRoles((prev) =>
            prev.map((pr) => {
              const existing = roles.find((r) => r.clientId === pr.clientId);
              return existing ? { ...pr, enabled: true, role: existing.role } : { ...pr, enabled: false };
            })
          );
        });
    } else {
      // Reset portal checkboxes for new grant
      setPortalRoles((prev) => prev.map((pr) => ({ ...pr, enabled: false, role: "STAFF" })));
    }
  }

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
    setShowGrantForm(false);
    setAccessError("");
  }

  async function handleGrantAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setAccessError("");
    setAccessSaving(true);
    const form = new FormData(e.currentTarget);
    const enabledPortalRoles = portalRoles
      .filter((pr) => pr.enabled)
      .map((pr) => ({ clientId: pr.clientId, role: pr.role }));
    const res = await fetch(`/api/employees/${selected.id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("accessEmail"),
        password: form.get("accessPassword"),
        portalRoles: enabledPortalRoles,
      }),
    });
    if (res.ok) {
      const empRes = await fetch(`/api/employees/${selected.id}`);
      if (empRes.ok) {
        const updatedEmp = await empRes.json();
        selectEmployee(updatedEmp);
      }
      setShowGrantForm(false);
      loadEmployees(showArchived);
    } else {
      const data = await res.json();
      setAccessError(data.error || "Failed to grant access.");
    }
    setAccessSaving(false);
  }

  async function handleUpdateRoles() {
    if (!selected) return;
    setAccessError("");
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${selected.id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portalRoles: portalRoles
          .filter((pr) => pr.enabled)
          .map((pr) => ({ clientId: pr.clientId, role: pr.role })),
      }),
    });
    if (res.ok) {
      const rolesRes = await fetch(`/api/employees/${selected.id}/access`);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setIdentityRoles(data.roles || []);
      }
      setShowManageRoles(false);
    } else {
      const data = await res.json();
      setAccessError(data.error || "Failed to update roles.");
    }
    setAccessSaving(false);
  }

  async function handleRevokeAccess() {
    if (!selected || !confirm("Revoke login access? They will no longer be able to log in.")) return;
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${selected.id}/access`, { method: "DELETE" });
    if (res.ok) {
      // Refresh employee
      const empRes = await fetch(`/api/employees/${selected.id}`);
      if (empRes.ok) {
        const updatedEmp = await empRes.json();
        setSelected(updatedEmp);
      }
    }
    setAccessSaving(false);
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
      roleIds: selectedRoleIds,
      employmentType: (form.get("employmentType") as string) || "",
      location: (form.get("location") as string) || "",
      startDate: (form.get("startDate") as string) || "",
      endDate: endDate || null,
      probationDate: probationDate || null,
      status,
      notes: (form.get("notes") as string) || "",
      emergencyFirstName: (form.get("emergencyFirstName") as string) || "",
      emergencyLastName: (form.get("emergencyLastName") as string) || "",
      emergencyRelation: (form.get("emergencyRelation") as string) || "",
      emergencyPhone: (form.get("emergencyPhone") as string) || "",
      emergencyPhoneAlt: (form.get("emergencyPhoneAlt") as string) || "",
    };

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSelectedRoleIds([]);
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
      roleIds: selectedRoleIds,
      employmentType: (form.get("employmentType") as string) || "",
      location: (form.get("location") as string) || "",
      startDate: (form.get("startDate") as string) || "",
      endDate: endDate || null,
      probationDate: probationDate || null,
      status,
      notes: (form.get("notes") as string) || "",
      emergencyFirstName: (form.get("emergencyFirstName") as string) || "",
      emergencyLastName: (form.get("emergencyLastName") as string) || "",
      emergencyRelation: (form.get("emergencyRelation") as string) || "",
      emergencyPhone: (form.get("emergencyPhone") as string) || "",
      emergencyPhoneAlt: (form.get("emergencyPhoneAlt") as string) || "",
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
            onClick={() => { setSelectedRoleIds([]); setCreating(true); }}
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
          data={filterByRegion(employees, selectedRegions)}
          onRowClick={(emp) => selectEmployee(emp)}
          emptyMessage={showArchived ? "No archived employees." : "No employees found. Click '+ Add Employee' to create one."}
        />
      )}

      {/* View / Edit Modal */}
      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <StatusBadge status={selected.status} />
                  {selected.isArchived && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Archived</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {selected.employeeNumber}
                  {selected.trainingRoles.length > 0 && <> &middot; {selected.trainingRoles.map((r) => r.role.name).join(", ")}</>}
                  {" "}&middot; {EMPLOYMENT_LABELS[selected.employmentType]}
                  {" "}&middot; {LOCATION_LABELS[selected.location]}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {selected.isArchived ? (
                  <button onClick={() => setConfirmAction({ type: "restore" })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">Restore</button>
                ) : (
                  <button onClick={() => { setSelectedRoleIds(selected.trainingRoles.map((r) => r.role.id)); setEditing(true); }} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">Edit</button>
                )}
              </div>
            </div>

            {/* ── Content sections ── */}
            <div className="space-y-4">
              {/* Employment */}
              <DetailSection title="Employment">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                  <DetailField label="Location" value={LOCATION_LABELS[selected.location]} />
                  <DetailField label="Start Date" value={formatDate(selected.startDate)} />
                  <DetailField label="Probation Review" value={formatDate(selected.probationDate)} />
                  <DetailField label="End Date" value={formatDate(selected.endDate)} />
                </div>
              </DetailSection>

              {/* Contact */}
              <DetailSection title="Contact">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                  <DetailField label="Phone" value={formatPhone(selected.phone)} />
                  <DetailField label="Work Email" value={selected.email} />
                  <DetailField label="Personal Email" value={selected.personalEmail} />
                  <DetailField label="Address" value={selected.address} className="col-span-2 md:col-span-3" />
                </div>
              </DetailSection>

              {/* Personal & Uniform — side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailSection title="Personal">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <DetailField label="Date of Birth" value={formatDate(selected.dateOfBirth)} />
                    <div />
                    <DetailField label="Shirt Size" value={selected.shirtSize} />
                    <DetailField label="Pants Size" value={selected.pantsSize} />
                  </div>
                </DetailSection>

                {/* Emergency Contact */}
                <DetailSection title="Emergency Contact" titleColor="text-red-600">
                  {selected.emergencyFirstName || selected.emergencyLastName || selected.emergencyPhone ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <DetailField
                        label="Name"
                        value={[selected.emergencyFirstName, selected.emergencyLastName].filter(Boolean).join(" ")}
                      />
                      <DetailField
                        label="Relationship"
                        value={selected.emergencyRelation ? (EMERGENCY_RELATION_LABELS[selected.emergencyRelation] || selected.emergencyRelation) : null}
                      />
                      <DetailField label="Contact Number" value={formatPhone(selected.emergencyPhone)} />
                      <DetailField label="Alt. Number" value={formatPhone(selected.emergencyPhoneAlt)} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </DetailSection>
              </div>

              {/* Notes */}
              {selected.notes && (
                <DetailSection title="Notes">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.notes}</p>
                </DetailSection>
              )}

              {/* Login Access — Admin only */}
              {isAdmin && (
                <DetailSection title="Login Access">
                  {!selected.identityId && !showGrantForm && (
                    <div>
                      <p className="text-sm text-gray-400 mb-3">No login access.</p>
                      <button onClick={() => setShowGrantForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Grant Access</button>
                    </div>
                  )}

                  {showGrantForm && (
                    <form onSubmit={handleGrantAccess} className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Login Email</label>
                          <input name="accessEmail" type="email" required defaultValue={selected.email || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                          <input name="accessPassword" type="text" required minLength={6} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Min. 6 characters" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Portal Access</label>
                        <div className="border border-gray-300 rounded-lg p-3 space-y-2">
                          {portals.length === 0 && <p className="text-xs text-gray-400">Loading portals...</p>}
                          {portals.map((portal) => {
                            const assignment = portalRoles.find((pr) => pr.clientId === portal.clientId);
                            return (
                              <div key={portal.clientId} className="flex items-center gap-3">
                                <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={assignment?.enabled || false}
                                    onChange={(e) => setPortalRoles((prev) => prev.map((pr) => pr.clientId === portal.clientId ? { ...pr, enabled: e.target.checked } : pr))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-900">{portal.name}</span>
                                </label>
                                {assignment?.enabled && (
                                  <select
                                    value={assignment.role}
                                    onChange={(e) => setPortalRoles((prev) => prev.map((pr) => pr.clientId === portal.clientId ? { ...pr, role: e.target.value } : pr))}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="STAFF">Staff</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="ADMIN">Admin</option>
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {accessError && <p className="text-sm text-red-500">{accessError}</p>}
                      <div className="flex gap-3">
                        <button type="submit" disabled={accessSaving || portalRoles.filter((pr) => pr.enabled).length === 0} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{accessSaving ? "Granting..." : "Grant Access"}</button>
                        <button type="button" onClick={() => { setShowGrantForm(false); setAccessError(""); }} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </form>
                  )}

                  {selected.identityId && !showGrantForm && (
                    <div>
                      <p className="text-sm text-green-700 mb-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Login access granted (managed via ACOMS.Auth)
                        </span>
                      </p>
                      {identityRoles.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Portal Roles</p>
                          <div className="space-y-1">
                            {identityRoles.map((r) => (
                              <div key={r.clientId} className="flex items-center gap-2 text-sm">
                                <span className="text-gray-700">{r.portalName}</span>
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.role}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setShowManageRoles(true)} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Manage Portal Roles</button>
                        <button onClick={handleRevokeAccess} disabled={accessSaving} className="border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">Revoke Access</button>
                      </div>
                      {showManageRoles && (
                        <div className="mt-3 border border-gray-200 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium text-gray-700 mb-2">Update Portal Roles</p>
                          {portals.map((portal) => {
                            const assignment = portalRoles.find((pr) => pr.clientId === portal.clientId);
                            return (
                              <div key={portal.clientId} className="flex items-center gap-3">
                                <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={assignment?.enabled || false}
                                    onChange={(e) => setPortalRoles((prev) => prev.map((pr) => pr.clientId === portal.clientId ? { ...pr, enabled: e.target.checked } : pr))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-900">{portal.name}</span>
                                </label>
                                {assignment?.enabled && (
                                  <select
                                    value={assignment.role}
                                    onChange={(e) => setPortalRoles((prev) => prev.map((pr) => pr.clientId === portal.clientId ? { ...pr, role: e.target.value } : pr))}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                                  >
                                    <option value="STAFF">Staff</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="ADMIN">Admin</option>
                                  </select>
                                )}
                              </div>
                            );
                          })}
                          {accessError && <p className="text-sm text-red-500">{accessError}</p>}
                          <div className="flex gap-2 pt-2">
                            <button onClick={handleUpdateRoles} disabled={accessSaving} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{accessSaving ? "Saving..." : "Save Roles"}</button>
                            <button onClick={() => { setShowManageRoles(false); setAccessError(""); }} className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DetailSection>
              )}
            </div>
            {(selected.createdAt || selected.updatedAt) && (
              <p className="mt-4 text-xs text-gray-400">
                {selected.updatedAt && selected.createdAt && selected.updatedAt !== selected.createdAt
                  ? `Last updated ${new Date(selected.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${selected.updatedByName ? ` by ${selected.updatedByName}` : ""} · `
                  : ""}
                {selected.createdAt
                  ? `Created ${new Date(selected.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${selected.createdByName ? ` by ${selected.createdByName}` : ""}`
                  : ""}
              </p>
            )}
          </div>
        )}

        {selected && editing && (
          <div>
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-gray-900">Edit Employee</h2>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {selected.employeeNumber} &middot; {selected.firstName} {selected.lastName}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              {/* ── Identity ── */}
              <EditSection title="Identity">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="First Name" name="firstName" required defaultValue={selected.firstName} />
                  <FormField label="Last Name" name="lastName" required defaultValue={selected.lastName} />
                  <FormField label="Date of Birth" name="dateOfBirth" type="date" defaultValue={formatDate(selected.dateOfBirth)} />
                </div>
              </EditSection>

              {/* ── Employment ── */}
              <EditSection title="Employment">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SelectField label="Employment Type" name="employmentType" required defaultValue={selected.employmentType} options={EMPLOYMENT_TYPE_OPTIONS} />
                  <SelectField label="Location" name="location" required defaultValue={selected.location} options={LOCATION_OPTIONS} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <SelectField label="Status" name="status" required defaultValue={selected.status} options={STATUS_OPTIONS} />
                  <FormField label="Start Date" name="startDate" type="date" required defaultValue={formatDate(selected.startDate)} />
                  <ClearableDateField label="Probation Review" name="probationDate" defaultValue={formatDate(selected.probationDate)} />
                  <ClearableDateField label="End Date" name="endDate" defaultValue={formatDate(selected.endDate)} />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
                  <div className="border border-gray-300 rounded-lg p-2 max-h-28 overflow-y-auto space-y-0.5">
                    {trainingRoles.length === 0 && <p className="text-xs text-gray-400 py-1">No roles created yet. Add roles in the Training tab.</p>}
                    {trainingRoles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(role.id)}
                          onChange={(e) => {
                            setSelectedRoleIds((prev) =>
                              e.target.checked ? [...prev, role.id] : prev.filter((id) => id !== role.id)
                            );
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">{role.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </EditSection>

              {/* ── Contact ── */}
              <EditSection title="Contact">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Phone" name="phone" defaultValue={selected.phone || ""} />
                  <FormField label="Work Email" name="email" type="email" defaultValue={selected.email || ""} />
                  <FormField label="Personal Email" name="personalEmail" type="email" defaultValue={selected.personalEmail || ""} />
                </div>
                <div className="mt-3">
                  <AddressAutocomplete label="Address" name="address" defaultValue={selected.address || ""} />
                </div>
              </EditSection>

              {/* ── Personal & Emergency Contact side by side ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EditSection title="Personal">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Shirt Size" name="shirtSize" defaultValue={selected.shirtSize || ""} options={SHIRT_SIZE_OPTIONS} />
                    <SelectField label="Pants Size" name="pantsSize" defaultValue={selected.pantsSize || ""} options={PANTS_SIZE_OPTIONS} />
                  </div>
                </EditSection>

                <EditSection title="Emergency Contact" titleColor="text-red-600">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField label="First Name" name="emergencyFirstName" defaultValue={selected.emergencyFirstName || ""} />
                    <FormField label="Last Name" name="emergencyLastName" defaultValue={selected.emergencyLastName || ""} />
                    <SelectField label="Relationship" name="emergencyRelation" defaultValue={selected.emergencyRelation || ""} options={EMERGENCY_RELATION_OPTIONS} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <FormField label="Contact Number" name="emergencyPhone" defaultValue={selected.emergencyPhone || ""} />
                    <FormField label="Alt. Number" name="emergencyPhoneAlt" defaultValue={selected.emergencyPhoneAlt || ""} />
                  </div>
                </EditSection>
              </div>

              {/* ── Notes ── */}
              <EditSection title="Notes">
                <TextAreaField label="" name="notes" defaultValue={selected.notes || ""} rows={2} />
              </EditSection>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              {/* ── Footer actions ── */}
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
                <div className="flex-1" />
                <button type="button" onClick={() => setConfirmAction({ type: "archive" })} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
            <div className="border border-gray-300 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
              {trainingRoles.length === 0 && <p className="text-xs text-gray-400 py-1">No roles created yet. Add roles in the Training tab.</p>}
              {trainingRoles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={(e) => {
                      setSelectedRoleIds((prev) =>
                        e.target.checked ? [...prev, role.id] : prev.filter((id) => id !== role.id)
                      );
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">{role.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Emergency Contact</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="First Name" name="emergencyFirstName" />
              <FormField label="Last Name" name="emergencyLastName" />
              <SelectField label="Relationship" name="emergencyRelation" options={EMERGENCY_RELATION_OPTIONS} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <FormField label="Contact Number" name="emergencyPhone" />
              <FormField label="Alternative Number" name="emergencyPhoneAlt" />
            </div>
          </div>

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

/* ─── View modal helper components ──────────────────── */

function DetailSection({ title, titleColor, children }: { title: string; titleColor?: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-4 py-2 border-b border-gray-100">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${titleColor || "text-gray-500"}`}>{title}</h3>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function DetailField({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || "—"}</dd>
    </div>
  );
}

function EditSection({ title, titleColor, children }: { title: string; titleColor?: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-4 py-2 border-b border-gray-100">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${titleColor || "text-gray-500"}`}>{title}</h3>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}
