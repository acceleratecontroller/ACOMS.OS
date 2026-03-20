"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
}

interface AccessInfo {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [trainingRoles, setTrainingRoles] = useState<TrainingRoleRef[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Login access state — isAdmin is detected by whether the access API returns 403
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);

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
    // Try to load access info — if 403, user is not admin
    fetch(`/api/employees/${id}/access`)
      .then((r) => {
        if (r.status === 403) {
          setIsAdmin(false);
          setAccessLoaded(true);
          return null;
        }
        if (r.ok) {
          setIsAdmin(true);
          return r.json();
        }
        setAccessLoaded(true);
        return null;
      })
      .then((data) => {
        if (data) {
          setAccess(data.access ?? null);
        }
        setAccessLoaded(true);
      })
      .catch(() => setAccessLoaded(true));
  }, [id]);

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
    const res = await fetch(`/api/employees/${id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("accessEmail"),
        password: form.get("accessPassword"),
        role: form.get("accessRole"),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setAccess(data);
      setShowGrantForm(false);
    } else {
      const data = await res.json();
      setAccessError(data.error || "Failed to grant access.");
    }
    setAccessSaving(false);
  }

  async function handleRevokeAccess() {
    if (!confirm("Revoke login access for this employee? They will no longer be able to log in.")) return;
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${id}/access`, { method: "DELETE" });
    if (res.ok) {
      setAccess((prev) => prev ? { ...prev, isActive: false } : null);
    }
    setAccessSaving(false);
  }

  async function handleReactivateAccess() {
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (res.ok) {
      setAccess((prev) => prev ? { ...prev, isActive: true } : null);
    }
    setAccessSaving(false);
  }

  async function handleChangeRole(newRole: string) {
    setAccessSaving(true);
    const res = await fetch(`/api/employees/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const data = await res.json();
      setAccess(data);
    }
    setAccessSaving(false);
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAccessError("");
    setAccessSaving(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/employees/${id}/access`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("newPassword") }),
    });

    if (res.ok) {
      setShowPasswordReset(false);
    } else {
      const data = await res.json();
      setAccessError(data.error || "Failed to reset password.");
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
          <div className="flex gap-3 mt-6 pt-4 border-t">
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
        {isAdmin && accessLoaded && (
          <div className="max-w-2xl mt-6 bg-white rounded border p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Login Access</h2>

            {!access && !showGrantForm && (
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    name="accessRole"
                    defaultValue="STAFF"
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="STAFF">Staff (limited access)</option>
                    <option value="ADMIN">Admin (full access)</option>
                  </select>
                </div>
                {accessError && <p className="text-sm text-red-500">{accessError}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={accessSaving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {accessSaving ? "Granting..." : "Grant Access"}
                  </button>
                  <button type="button" onClick={() => { setShowGrantForm(false); setAccessError(""); }} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {access && (
              <div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
                  <div>
                    <dt className="text-gray-500">Login Email</dt>
                    <dd className="font-medium">{access.email}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${access.isActive ? "text-green-700" : "text-red-600"}`}>
                        <span className={`w-2 h-2 rounded-full ${access.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        {access.isActive ? "Active" : "Revoked"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Role</dt>
                    <dd className="font-medium flex items-center gap-2">
                      {access.role}
                      <select
                        value={access.role}
                        onChange={(e) => handleChangeRole(e.target.value)}
                        disabled={accessSaving}
                        className="ml-2 text-xs border border-gray-300 rounded px-1 py-0.5"
                      >
                        <option value="STAFF">STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </dd>
                  </div>
                </dl>

                {showPasswordReset ? (
                  <form onSubmit={handleResetPassword} className="mb-3 space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        name="newPassword"
                        type="text"
                        required
                        minLength={6}
                        className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Min. 6 characters"
                      />
                    </div>
                    {accessError && <p className="text-sm text-red-500">{accessError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={accessSaving} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {accessSaving ? "Resetting..." : "Reset Password"}
                      </button>
                      <button type="button" onClick={() => { setShowPasswordReset(false); setAccessError(""); }} className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setShowPasswordReset(true)} className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50">
                      Reset Password
                    </button>
                    {access.isActive ? (
                      <button onClick={handleRevokeAccess} disabled={accessSaving} className="border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50">
                        Revoke Access
                      </button>
                    ) : (
                      <button onClick={handleReactivateAccess} disabled={accessSaving} className="border border-green-300 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-50 disabled:opacity-50">
                        Reactivate Access
                      </button>
                    )}
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
