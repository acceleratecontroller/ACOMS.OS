"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import {
  PLANT_STATUS_OPTIONS,
  CONDITION_OPTIONS,
  LOCATION_OPTIONS,
  STATE_OPTIONS,
  LICENCE_TYPE_OPTIONS,
  PLANT_CATEGORY_OPTIONS,
} from "@/config/constants";

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
    // Convert empty strings to undefined so optional enum/numeric fields don't fail validation
    const val = (key: string) => { const v = form.get(key); return v === "" || v === null ? undefined : v; };
    const body = {
      category: val("category"),
      stateRegistered: val("stateRegistered"),
      registrationNumber: val("registrationNumber"),
      vinNumber: val("vinNumber"),
      year: val("year"),
      make: val("make"),
      model: val("model"),
      licenceType: val("licenceType"),
      location: val("location"),
      assignedToId: val("assignedToId"),
      ampolCardNumber: val("ampolCardNumber"),
      ampolCardExpiry: val("ampolCardExpiry"),
      linktTagNumber: val("linktTagNumber"),
      fleetDynamicsSerialNumber: val("fleetDynamicsSerialNumber"),
      coiExpirationDate: val("coiExpirationDate"),
      purchaseDate: val("purchaseDate"),
      purchasePrice: val("purchasePrice"),
      comments: val("comments"),
      lastServiceDate: val("lastServiceDate"),
      nextServiceDue: val("nextServiceDue"),
      status: val("status"),
      condition: val("condition"),
    };

    const res = await fetch("/api/plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const created = await res.json();
      router.push(`/plant?open=${created.id}`);
    } else {
      const data = await res.json();
      if (data.details && Array.isArray(data.details)) {
        setError(data.details.map((d: { path?: string[]; message?: string }) => `${(d.path || []).join(".")}: ${d.message}`).join(", "));
      } else {
        setError(data.error || "Failed to create plant item.");
      }
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add Plant" />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" name="category" required options={PLANT_CATEGORY_OPTIONS} />
          <SelectField label="Status" name="status" required defaultValue="OPERATIONAL" options={PLANT_STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="State Registered" name="stateRegistered" options={STATE_OPTIONS} />
          <FormField label="Registration Number" name="registrationNumber" placeholder="e.g. ABC-123" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="VIN Number" name="vinNumber" />
          <FormField label="Year" name="year" type="number" placeholder="e.g. 2020" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Make" name="make" placeholder="e.g. Caterpillar" />
          <FormField label="Model" name="model" placeholder="e.g. 320" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Licence Type Required" name="licenceType" options={LICENCE_TYPE_OPTIONS} />
          <SelectField label="Location" name="location" options={LOCATION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Assigned To (Employee)"
            name="assignedToId"
            options={employees.map((emp) => ({
              value: emp.id,
              label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`,
            }))}
          />
          <SelectField label="Condition" name="condition" options={CONDITION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Ampol Card Number" name="ampolCardNumber" />
          <FormField label="Ampol Card Expiry" name="ampolCardExpiry" type="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Linkt Tag Number" name="linktTagNumber" />
          <FormField label="Fleet Dynamics Serial Number" name="fleetDynamicsSerialNumber" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="COI Expiration Date" name="coiExpirationDate" type="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Purchase Date" name="purchaseDate" type="date" />
          <FormField label="Purchase Price" name="purchasePrice" type="number" placeholder="0.00" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Last Service Date" name="lastServiceDate" type="date" />
          <FormField label="Next Service Due" name="nextServiceDue" type="date" />
        </div>
        <TextAreaField label="Comments" name="comments" placeholder="Optional comments..." />

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
