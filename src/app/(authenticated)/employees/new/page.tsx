"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { AddressAutocomplete } from "@/shared/components/AddressAutocomplete";

export default function NewEmployeePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      router.push("/employees");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create employee.");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add Employee" description="Employee number will be auto-generated." />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First Name" name="firstName" required />
          <FormField label="Last Name" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Work Email" name="email" type="email" />
          <FormField label="Personal Email" name="personalEmail" type="email" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone" name="phone" />
          <FormField label="Date of Birth" name="dateOfBirth" type="date" />
        </div>
        <AddressAutocomplete label="Address" name="address" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Role Type" name="roleType" required options={[
            { value: "OFFICE", label: "Office" },
            { value: "FIELD", label: "Field" },
          ]} />
          <SelectField label="Employment Type" name="employmentType" required options={[
            { value: "FULL_TIME", label: "Full-Time" },
            { value: "TRAINEE", label: "Trainee" },
            { value: "CASUAL", label: "Casual" },
            { value: "ABN", label: "ABN" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Location" name="location" required options={[
            { value: "BRISBANE", label: "Brisbane" },
            { value: "BUNDABERG", label: "Bundaberg" },
            { value: "HERVEY_BAY", label: "Hervey Bay" },
            { value: "MACKAY", label: "Mackay" },
            { value: "OTHER", label: "Other" },
          ]} />
          <SelectField label="Status" name="status" required defaultValue="ACTIVE" options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "TERMINATED", label: "Terminated" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date" name="startDate" type="date" required />
          <FormField label="Probation Review Date" name="probationDate" type="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Shirt Size" name="shirtSize" options={[
            { value: "XS", label: "XS" }, { value: "S", label: "S" }, { value: "M", label: "M" },
            { value: "L", label: "L" }, { value: "XL", label: "XL" }, { value: "2XL", label: "2XL" },
            { value: "3XL", label: "3XL" }, { value: "4XL", label: "4XL" }, { value: "5XL", label: "5XL" },
          ]} />
          <SelectField label="Pants Size" name="pantsSize" options={[
            { value: "28", label: "28" }, { value: "30", label: "30" }, { value: "32", label: "32" },
            { value: "34", label: "34" }, { value: "36", label: "36" }, { value: "38", label: "38" },
            { value: "40", label: "40" }, { value: "42", label: "42" }, { value: "44", label: "44" },
          ]} />
        </div>
        <TextAreaField label="Notes" name="notes" placeholder="Optional notes..." />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Employee"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/employees")}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
