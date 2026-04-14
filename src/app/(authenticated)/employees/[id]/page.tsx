// ⚠️  IMPORTANT: This page contains a Login Access section (grant/revoke/manage portal roles).
// A duplicate of this section also exists in employees/page.tsx (list page side panel).
// If you change the login access UI or logic here, update the list page too (and vice versa).

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { AddressAutocomplete } from "@/shared/components/AddressAutocomplete";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  LOCATION_LABELS,
  LOCATION_OPTIONS,
  EMPLOYMENT_LABELS,
  EMPLOYMENT_TYPE_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS as STATUS_OPTIONS,
  SHIRT_SIZE_OPTIONS,
  PANTS_SIZE_OPTIONS,
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
  location: string;
  startDate: string;
  endDate: string | null;
  probationDate: string | null;
  status: string;
  notes: string | null;
  isArchived: boolean;
  trainingRoles: { role: TrainingRoleRef }[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string | null;
  updatedByName?: string | null;
}

interface AccessInfo {
  identityId: string;
  email: string;
}

interface Portal {
  clientId: string;
  name: string;
  isActive: boolean;
}

interface PortalRoleAssignment {
  clientId: string;
  role: string;
  enabled: boolean;
}

interface IdentityRole {
  clientId: string;
  portalName: string;
  role: string;
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const session = useSession();
  const isAdmin = session.data?.user?.role === "ADMIN";

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [trainingRoles, setTrainingRoles] = useState<TrainingRoleRef[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Login access state
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [portalRoles, setPortalRoles] = useState<PortalRoleAssignment[]>([]);
  const [identityRoles, setIdentityRoles] = useState<IdentityRole[]>([]);
  const [showManageRoles, setShowManageRoles] = useState(false);

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setEmployee(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/training/roles")
      .then((r) => r.ok ? r.json() : [])
      .then((data: TrainingRoleRef[]) => setTrainingRoles(data));
  }, [id]);

  // Fetch portals from Auth when admin opens grant form or manage roles
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/portals")
      .then((r) => r.ok ? r.json() : { portals: [] })
      .then((data: { portals: Portal[] }) => {
        const activePortals = (data.portals || []).filter((p) => p.isActive);
        setPortals(activePortals);
        setPortalRoles(activePortals.map((p) => ({ clientId: p.clientId, role: "STAFF", enabled: false })));
      });
  }, [isAdmin]);

  // Fetch identity roles when employee has access
  useEffect(() => {
    if (!employee?.identityId || !isAdmin) return;
    fetch(`/api/employees/${id}/access`)
      .then((r) => r.ok ? r.json() : { roles: [] })
      .then((data: { roles: IdentityRole[] }) => {
        const roles = data.roles || [];
        setIdentityRoles(roles);
        // Pre-populate portal role checkboxes with existing assignments
        setPortalRoles((prev) =>
          prev.map((pr) => {
            const existing = roles.find((r) => r.clientId === pr.clientId);
            return existing ? { ...pr, enabled: true, role: existing.role } : { ...pr, enabled: false };
          })
        );
      });
  }, [employee?.identityId, isAdmin, id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      personalEmail: form.get("personalEmail"),
      phone: form.get("phone"),
      address: form.get("address"),
      dateOfBirth: form.get("dateOfBirth") || null,
      shirtSize: form.get("shirtSize"),
      pantsSize: form.get("pantsSize"),
      roleIds: selectedRoleIds,
      employmentType: form.get("employmentType"),
      location: form.get("location"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      probationDate: form.get("probationDate"),
      status: form.get("status"),
      notes: form.get("notes"),
    };

    const res = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      setEmployee(updated);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update.");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this employee?")) return;

    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/employees");
    }
  }

  async function handleGrantAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAccessError("");
    setAccessSaving(true);

    const form = new FormData(e.currentTarget);
    const enabledPortalRoles = portalRoles
      .filter((pr) => pr.enabled)
      .map((pr) => ({ clientId: pr.clientId, role: pr.role }));

    const res = await fetch(`/api/employees/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("accessEmail"),
        password: form.get("accessPassword"),
        portalRoles: enabledPortalRoles,
      }),
    });

    if (res.ok) {
      // Refresh employee to get updated identityId
      const empRes = await fetch(`/api/employees/${id}`);
      if (empRes.ok) setEmployee(await empRes.json());
      setShowGrantForm(false);
    } else {
      const data = await res.json();
      setAccessError(data.error || "Failed to grant access.");
    }
    setAccessSaving(false);
  }

  async function handleUpdateRoles() {
    setAccessError("");
    setAccessSaving(true);

    const res = await fetch(`/api/employees/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portalRoles: portalRoles
          .filter((pr) => pr.enabled)
          .map((pr) => ({ clientId: pr.clientId, role: pr.role })),
      }),
    });

    if (res.ok) {
      // Refresh identity roles
      const rolesRes = await fetch(`/api/employees/${id}/access`);
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
    if (!confirm("Revoke login access for this employee? They will no longer be able to log in.")) return;
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${id}/access`, { method: "DELETE" });
    if (res.ok) {
      // Refresh employee to reflect revoked access
      const empRes = await fetch(`/api/employees/${id}`);
      if (empRes.ok) setEmployee(await empRes.json());
    }
    setAccessSaving(false);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!employee) return <p className="text-sm text-red-500">Employee not found.</p>;

  const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

  if (!editing) {
    return (
      <div>
        <PageHeader title={`${employee.firstName} ${employee.lastName}`} />
        <div className="max-w-2xl bg-white rounded border p-6">
          <div className="flex gap-2 mb-6">
            <StatusBadge status={employee.status} />
            {employee.isArchived && <StatusBadge status="ARCHIVED" />}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><dt className="text-gray-500">Employee #</dt><dd className="font-medium">{employee.employeeNumber}</dd></div>
            <div><dt className="text-gray-500">Roles</dt><dd className="font-medium">{employee.trainingRoles.length > 0 ? employee.trainingRoles.map((r) => r.role.name).join(", ") : "—"}</dd></div>
            <div><dt className="text-gray-500">Employment Type</dt><dd className="font-medium">{EMPLOYMENT_LABELS[employee.employmentType] || employee.employmentType}</dd></div>
            <div><dt className="text-gray-500">Location</dt><dd className="font-medium">{LOCATION_LABELS[employee.location] || employee.location}</dd></div>
            <div><dt className="text-gray-500">Work Email</dt><dd className="font-medium">{employee.email || "—"}</dd></div>
            <div><dt className="text-gray-500">Personal Email</dt><dd className="font-medium">{employee.personalEmail || "—"}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{employee.phone || "—"}</dd></div>
            <div><dt className="text-gray-500">Date of Birth</dt><dd className="font-medium">{formatDate(employee.dateOfBirth) || "—"}</dd></div>
            <div className="col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium">{employee.address || "—"}</dd></div>
            <div><dt className="text-gray-500">Start Date</dt><dd className="font-medium">{formatDate(employee.startDate)}</dd></div>
            <div><dt className="text-gray-500">End Date</dt><dd className="font-medium">{formatDate(employee.endDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Probation Review Date</dt><dd className="font-medium">{formatDate(employee.probationDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Shirt Size</dt><dd className="font-medium">{employee.shirtSize || "—"}</dd></div>
            <div><dt className="text-gray-500">Pants Size</dt><dd className="font-medium">{employee.pantsSize || "—"}</dd></div>
          </dl>
          {employee.notes && (
            <div className="mt-4 text-sm">
              <p className="text-gray-500 mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{employee.notes}</p>
            </div>
          )}
          {(employee.createdAt || employee.updatedAt) && (
            <p className="mt-6 text-xs text-gray-400">
              {employee.updatedAt && employee.createdAt && employee.updatedAt !== employee.createdAt
                ? `Last updated ${new Date(employee.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${employee.updatedByName ? ` by ${employee.updatedByName}` : ""} · `
                : ""}
              {employee.createdAt
                ? `Created ${new Date(employee.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${employee.createdByName ? ` by ${employee.createdByName}` : ""}`
                : ""}
            </p>
          )}
          <div className="flex gap-3 mt-4 pt-4 border-t">
            {isAdmin && (
              <>
                <button onClick={() => { setSelectedRoleIds(employee.trainingRoles.map((r) => r.role.id)); setEditing(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Edit</button>
                <button onClick={handleArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Archive</button>
              </>
            )}
            <button onClick={() => router.push("/employees")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">Back to list</button>
          </div>
        </div>

        {/* Login Access Section — Admin only */}
        {isAdmin && (
          <div className="max-w-2xl mt-6 bg-white rounded border p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Login Access</h2>

            {!employee.identityId && !showGrantForm && (
              <div>
                <p className="text-sm text-gray-500 mb-3">This employee does not have login access.</p>
                <button
                  onClick={() => setShowGrantForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Grant Access
                </button>
              </div>
            )}

            {showGrantForm && (
              <form onSubmit={handleGrantAccess} className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Login Email</label>
                    <input
                      name="accessEmail"
                      type="email"
                      required
                      defaultValue={employee.email || ""}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                    <input
                      name="accessPassword"
                      type="text"
                      required
                      minLength={6}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Min. 6 characters"
                    />
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
                              onChange={(e) => {
                                setPortalRoles((prev) =>
                                  prev.map((pr) =>
                                    pr.clientId === portal.clientId ? { ...pr, enabled: e.target.checked } : pr
                                  )
                                );
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">{portal.name}</span>
                          </label>
                          {assignment?.enabled && (
                            <select
                              value={assignment.role}
                              onChange={(e) => {
                                setPortalRoles((prev) =>
                                  prev.map((pr) =>
                                    pr.clientId === portal.clientId ? { ...pr, role: e.target.value } : pr
                                  )
                                );
                              }}
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
                  <button type="submit" disabled={accessSaving || portalRoles.filter((pr) => pr.enabled).length === 0} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {accessSaving ? "Granting..." : "Grant Access"}
                  </button>
                  <button type="button" onClick={() => { setShowGrantForm(false); setAccessError(""); }} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {employee.identityId && !showGrantForm && (
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
                  <button onClick={() => setShowManageRoles(true)} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                    Manage Portal Roles
                  </button>
                  <button onClick={handleRevokeAccess} disabled={accessSaving} className="border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50">
                    Revoke Access
                  </button>
                </div>
                {showManageRoles && (
                  <div className="mt-3 border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">Update Portal Roles</p>
                    {portals.map((portal) => {
                      const existing = identityRoles.find((r) => r.clientId === portal.clientId);
                      const assignment = portalRoles.find((pr) => pr.clientId === portal.clientId);
                      return (
                        <div key={portal.clientId} className="flex items-center gap-3">
                          <label className="flex items-center gap-2 min-w-[160px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assignment?.enabled || false}
                              onChange={(e) => {
                                setPortalRoles((prev) =>
                                  prev.map((pr) =>
                                    pr.clientId === portal.clientId ? { ...pr, enabled: e.target.checked } : pr
                                  )
                                );
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">{portal.name}</span>
                          </label>
                          {assignment?.enabled && (
                            <select
                              value={assignment.role}
                              onChange={(e) => {
                                setPortalRoles((prev) =>
                                  prev.map((pr) =>
                                    pr.clientId === portal.clientId ? { ...pr, role: e.target.value } : pr
                                  )
                                );
                              }}
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
                      <button
                        onClick={handleUpdateRoles}
                        disabled={accessSaving}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {accessSaving ? "Saving..." : "Save Roles"}
                      </button>
                      <button
                        onClick={() => { setShowManageRoles(false); setAccessError(""); }}
                        className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Edit: ${employee.firstName} ${employee.lastName}`} description={`Employee # ${employee.employeeNumber}`} />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First Name" name="firstName" required defaultValue={employee.firstName} />
          <FormField label="Last Name" name="lastName" required defaultValue={employee.lastName} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Work Email" name="email" type="email" defaultValue={employee.email || ""} />
          <FormField label="Personal Email" name="personalEmail" type="email" defaultValue={employee.personalEmail || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone" name="phone" defaultValue={employee.phone || ""} />
          <FormField label="Date of Birth" name="dateOfBirth" type="date" defaultValue={formatDate(employee.dateOfBirth)} />
        </div>
        <AddressAutocomplete label="Address" name="address" defaultValue={employee.address || ""} />
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
                      e.target.checked ? [...prev, role.id] : prev.filter((rid) => rid !== role.id)
                    );
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">{role.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Employment Type" name="employmentType" required defaultValue={employee.employmentType} options={EMPLOYMENT_TYPE_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Location" name="location" required defaultValue={employee.location} options={LOCATION_OPTIONS} />
          <SelectField label="Status" name="status" required defaultValue={employee.status} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date" name="startDate" type="date" required defaultValue={formatDate(employee.startDate)} />
          <FormField label="End Date" name="endDate" type="date" defaultValue={formatDate(employee.endDate)} />
        </div>
        <FormField label="Probation Review Date" name="probationDate" type="date" defaultValue={formatDate(employee.probationDate)} />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Shirt Size" name="shirtSize" defaultValue={employee.shirtSize || ""} options={SHIRT_SIZE_OPTIONS} />
          <SelectField label="Pants Size" name="pantsSize" defaultValue={employee.pantsSize || ""} options={PANTS_SIZE_OPTIONS} />
        </div>
        <TextAreaField label="Notes" name="notes" defaultValue={employee.notes || ""} />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
