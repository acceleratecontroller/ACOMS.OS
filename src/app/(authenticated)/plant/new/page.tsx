"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { LOCATION_OPTIONS } from "@/config/constants";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function NewPlantPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      category: form.get("category"),
      make: form.get("make"),
      model: form.get("model"),
      serialNumber: form.get("serialNumber"),
      yearOfManufacture: form.get("yearOfManufacture"),
      registrationNumber: form.get("registrationNumber"),
      purchaseDate: form.get("purchaseDate"),
      purchaseCost: form.get("purchaseCost"),
      location: form.get("location"),
      assignedToId: form.get("assignedToId"),
      status: form.get("status"),
      condition: form.get("condition"),
      lastServiceDate: form.get("lastServiceDate"),
      nextServiceDue: form.get("nextServiceDue"),
      notes: form.get("notes"),
    };

    const res = await fetch("/api/plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/plant");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create plant item.");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add Plant" />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Status" name="status" required defaultValue="OPERATIONAL" options={[
            { value: "OPERATIONAL", label: "Operational" },
            { value: "MAINTENANCE", label: "Maintenance" },
            { value: "DECOMMISSIONED", label: "Decommissioned" },
            { value: "STANDBY", label: "Standby" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" name="name" required placeholder="e.g. CAT 320 Excavator" />
          <FormField label="Category" name="category" required placeholder="e.g. Excavator" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Make" name="make" placeholder="e.g. Caterpillar" />
          <FormField label="Model" name="model" placeholder="e.g. 320" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Serial Number" name="serialNumber" />
          <FormField label="Year of Manufacture" name="yearOfManufacture" type="number" placeholder="e.g. 2020" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Registration Number" name="registrationNumber" placeholder="e.g. ABC-123" />
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Last Service Date" name="lastServiceDate" type="date" />
          <FormField label="Next Service Due" name="nextServiceDue" type="date" />
        </div>
        <TextAreaField label="Notes" name="notes" placeholder="Optional notes..." />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Create Plant Item"}
          </button>
          <button type="button" onClick={() => router.push("/plant")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
