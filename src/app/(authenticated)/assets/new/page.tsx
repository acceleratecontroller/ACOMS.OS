"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import TagComboBox from "@/shared/components/TagComboBox";
import { LOCATION_OPTIONS } from "@/config/constants";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function NewAssetPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [externallyOwned, setExternallyOwned] = useState(false);
  const [externalOwnerId, setExternalOwnerId] = useState("");

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!categoryId) {
      setError("Category is required");
      return;
    }
    if (externallyOwned && !externalOwnerId) {
      setError("External owner is required when 'Owned by external party' is ticked");
      return;
    }
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      categoryId,
      make: form.get("make"),
      model: form.get("model"),
      serialNumber: form.get("serialNumber"),
      purchaseDate: form.get("purchaseDate"),
      purchaseCost: form.get("purchaseCost"),
      location: form.get("location"),
      assignedToId: form.get("assignedToId"),
      externallyOwned,
      externalOwnerId: externallyOwned ? externalOwnerId : null,
      status: form.get("status"),
      condition: form.get("condition"),
      notes: form.get("notes"),
    };

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/assets");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create asset.");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add Asset" />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Status" name="status" required defaultValue="AVAILABLE" options={[
            { value: "AVAILABLE", label: "Available" },
            { value: "IN_USE", label: "In Use" },
            { value: "MAINTENANCE", label: "Maintenance" },
            { value: "RETIRED", label: "Retired" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" name="name" required placeholder="e.g. Makita Impact Drill" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <TagComboBox
              value={categoryId}
              onChange={(id) => setCategoryId(id)}
              endpoint="/api/assets/categories"
              placeholder="Search or create..."
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 -mt-1">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={externallyOwned}
              onChange={(e) => {
                setExternallyOwned(e.target.checked);
                if (!e.target.checked) setExternalOwnerId("");
              }}
              className="rounded border-gray-300"
            />
            <span>Owned by external party</span>
          </label>
          {externallyOwned && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner <span className="text-red-500">*</span></label>
              <TagComboBox
                value={externalOwnerId}
                onChange={(id) => setExternalOwnerId(id)}
                endpoint="/api/assets/owners"
                placeholder="Search or create company..."
                emptyHint="No owners yet — type a company name to create one"
                required
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Make" name="make" placeholder="e.g. Makita" />
          <FormField label="Model" name="model" placeholder="e.g. DTD172" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Serial Number" name="serialNumber" />
          <SelectField label="Condition" name="condition" options={[
            { value: "NEW", label: "New" },
            { value: "GOOD", label: "Good" },
            { value: "FAIR", label: "Fair" },
            { value: "POOR", label: "Poor" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Purchase Date" name="purchaseDate" type="date" />
          <FormField label="Purchase Cost" name="purchaseCost" type="number" placeholder="0.00" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Location" name="location" options={LOCATION_OPTIONS} />
          <SelectField
            label="Assigned To (Employee)"
            name="assignedToId"
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`,
            }))}
          />
        </div>
        <TextAreaField label="Notes" name="notes" placeholder="Optional notes..." />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Create Asset"}
          </button>
          <button type="button" onClick={() => router.push("/assets")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
