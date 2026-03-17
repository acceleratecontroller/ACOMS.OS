"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { AddressAutocomplete } from "@/shared/components/AddressAutocomplete";
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

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setEmployee(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      roleType: form.get("roleType"),
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
            <div><dt className="text-gray-500">Role Type</dt><dd className="font-medium">{employee.roleType === "OFFICE" ? "Office" : "Field"}</dd></div>
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
            <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Edit</button>
            <button onClick={handleArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Archive</button>
            <button onClick={() => router.push("/employees")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">Back to list</button>
          </div>
        </div>
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
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Role Type" name="roleType" required defaultValue={employee.roleType} options={[
            { value: "OFFICE", label: "Office" },
            { value: "FIELD", label: "Field" },
          ]} />
          <SelectField label="Employment Type" name="employmentType" required defaultValue={employee.employmentType} options={[
            { value: "FULL_TIME", label: "Full-Time" },
            { value: "TRAINEE", label: "Trainee" },
            { value: "CASUAL", label: "Casual" },
            { value: "ABN", label: "ABN" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Location" name="location" required defaultValue={employee.location} options={[
            { value: "BRISBANE", label: "Brisbane" },
            { value: "BUNDABERG", label: "Bundaberg" },
            { value: "HERVEY_BAY", label: "Hervey Bay" },
            { value: "MACKAY", label: "Mackay" },
            { value: "OTHER", label: "Other" },
          ]} />
          <SelectField label="Status" name="status" required defaultValue={employee.status} options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "TERMINATED", label: "Terminated" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date" name="startDate" type="date" required defaultValue={formatDate(employee.startDate)} />
          <FormField label="End Date" name="endDate" type="date" defaultValue={formatDate(employee.endDate)} />
        </div>
        <FormField label="Probation Review Date" name="probationDate" type="date" defaultValue={formatDate(employee.probationDate)} />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Shirt Size" name="shirtSize" defaultValue={employee.shirtSize || ""} options={[
            { value: "XS", label: "XS" }, { value: "S", label: "S" }, { value: "M", label: "M" },
            { value: "L", label: "L" }, { value: "XL", label: "XL" }, { value: "2XL", label: "2XL" },
            { value: "3XL", label: "3XL" }, { value: "4XL", label: "4XL" }, { value: "5XL", label: "5XL" },
          ]} />
          <SelectField label="Pants Size" name="pantsSize" defaultValue={employee.pantsSize || ""} options={[
            { value: "28", label: "28" }, { value: "30", label: "30" }, { value: "32", label: "32" },
            { value: "34", label: "34" }, { value: "36", label: "36" }, { value: "38", label: "38" },
            { value: "40", label: "40" }, { value: "42", label: "42" }, { value: "44", label: "44" },
          ]} />
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
