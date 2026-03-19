"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  PLANT_STATUS_OPTIONS as STATUS_OPTIONS,
  CONDITION_OPTIONS,
  LOCATION_OPTIONS,
  LOCATION_LABELS,
  STATE_OPTIONS,
  LICENCE_TYPE_OPTIONS,
} from "@/config/constants";

interface PlantItem {
  id: string;
  plantNumber: string;
  category: string;
  stateRegistered: string | null;
  registrationNumber: string | null;
  vinNumber: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  licenceType: string | null;
  regionAssigned: string | null;
  location: string | null;
  ampolCardNumber: string | null;
  ampolCardExpiry: string | null;
  linktTagNumber: string | null;
  fleetDynamicsSerialNumber: string | null;
  coiExpirationDate: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  soldDate: string | null;
  soldPrice: string | null;
  comments: string | null;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  status: string;
  condition: string | null;
  isArchived: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
}

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function PlantDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [plant, setPlant] = useState<PlantItem | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/plant/${id}`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([plantData, empData]) => {
      setPlant(plantData);
      setEmployees(empData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      category: form.get("category"),
      stateRegistered: form.get("stateRegistered"),
      registrationNumber: form.get("registrationNumber"),
      vinNumber: form.get("vinNumber"),
      year: form.get("year"),
      make: form.get("make"),
      model: form.get("model"),
      licenceType: form.get("licenceType"),
      regionAssigned: form.get("regionAssigned"),
      location: form.get("location"),
      assignedToId: form.get("assignedToId"),
      ampolCardNumber: form.get("ampolCardNumber"),
      ampolCardExpiry: form.get("ampolCardExpiry"),
      linktTagNumber: form.get("linktTagNumber"),
      fleetDynamicsSerialNumber: form.get("fleetDynamicsSerialNumber"),
      coiExpirationDate: form.get("coiExpirationDate"),
      purchaseDate: form.get("purchaseDate"),
      purchasePrice: form.get("purchasePrice"),
      soldDate: form.get("soldDate"),
      soldPrice: form.get("soldPrice"),
      comments: form.get("comments"),
      lastServiceDate: form.get("lastServiceDate"),
      nextServiceDue: form.get("nextServiceDue"),
      status: form.get("status"),
      condition: form.get("condition"),
    };

    const res = await fetch(`/api/plant/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      setPlant(updated);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update.");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this plant item?")) return;
    const res = await fetch(`/api/plant/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/plant");
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!plant) return <p className="text-sm text-red-500">Plant item not found.</p>;

  const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

  if (!editing) {
    return (
      <div>
        <PageHeader title={plant.plantNumber} />
        <div className="max-w-2xl bg-white rounded border p-6">
          <div className="flex gap-2 mb-6">
            <StatusBadge status={plant.status} />
            {plant.condition && <StatusBadge status={plant.condition} />}
            {plant.isArchived && <StatusBadge status="ARCHIVED" />}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><dt className="text-gray-500">Plant #</dt><dd className="font-medium">{plant.plantNumber}</dd></div>
            <div><dt className="text-gray-500">Category</dt><dd className="font-medium">{plant.category}</dd></div>
            <div><dt className="text-gray-500">State Registered</dt><dd className="font-medium">{plant.stateRegistered || "—"}</dd></div>
            <div><dt className="text-gray-500">Registration</dt><dd className="font-medium">{plant.registrationNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">VIN Number</dt><dd className="font-medium">{plant.vinNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">Year</dt><dd className="font-medium">{plant.year || "—"}</dd></div>
            <div><dt className="text-gray-500">Make</dt><dd className="font-medium">{plant.make || "—"}</dd></div>
            <div><dt className="text-gray-500">Model</dt><dd className="font-medium">{plant.model || "—"}</dd></div>
            <div><dt className="text-gray-500">Licence Type</dt><dd className="font-medium">{plant.licenceType || "—"}</dd></div>
            <div><dt className="text-gray-500">Region Assigned</dt><dd className="font-medium">{plant.regionAssigned ? (LOCATION_LABELS[plant.regionAssigned] || plant.regionAssigned) : "—"}</dd></div>
            <div><dt className="text-gray-500">Location</dt><dd className="font-medium">{plant.location ? (LOCATION_LABELS[plant.location] || plant.location) : "—"}</dd></div>
            <div><dt className="text-gray-500">Assigned To</dt><dd className="font-medium">{plant.assignedTo ? `${plant.assignedTo.firstName} ${plant.assignedTo.lastName} (${plant.assignedTo.employeeNumber})` : "—"}</dd></div>
            <div><dt className="text-gray-500">Ampol Card #</dt><dd className="font-medium">{plant.ampolCardNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">Ampol Card Expiry</dt><dd className="font-medium">{formatDate(plant.ampolCardExpiry) || "—"}</dd></div>
            <div><dt className="text-gray-500">Linkt Tag #</dt><dd className="font-medium">{plant.linktTagNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">Fleet Dynamics Serial</dt><dd className="font-medium">{plant.fleetDynamicsSerialNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">COI Expiration</dt><dd className="font-medium">{formatDate(plant.coiExpirationDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Purchase Date</dt><dd className="font-medium">{formatDate(plant.purchaseDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Purchase Price</dt><dd className="font-medium">{plant.purchasePrice ? `$${plant.purchasePrice}` : "—"}</dd></div>
            <div><dt className="text-gray-500">Sold Date</dt><dd className="font-medium">{formatDate(plant.soldDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Sold Price</dt><dd className="font-medium">{plant.soldPrice ? `$${plant.soldPrice}` : "—"}</dd></div>
            <div><dt className="text-gray-500">Last Service</dt><dd className="font-medium">{formatDate(plant.lastServiceDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Next Service Due</dt><dd className="font-medium">{formatDate(plant.nextServiceDue) || "—"}</dd></div>
          </dl>
          {plant.comments && (
            <div className="mt-4 text-sm">
              <p className="text-gray-500 mb-1">Comments</p>
              <p className="whitespace-pre-wrap">{plant.comments}</p>
            </div>
          )}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Edit</button>
            <button onClick={handleArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Archive</button>
            <button onClick={() => router.push("/plant")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">Back to list</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Edit: ${plant.plantNumber}`} />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plant Number</label>
            <p className="text-sm font-medium text-gray-900 py-2">{plant.plantNumber}</p>
          </div>
          <SelectField label="Status" name="status" required defaultValue={plant.status} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" name="category" required defaultValue={plant.category} />
          <SelectField label="Condition" name="condition" defaultValue={plant.condition || ""} options={CONDITION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="State Registered" name="stateRegistered" defaultValue={plant.stateRegistered || ""} options={STATE_OPTIONS} />
          <FormField label="Registration Number" name="registrationNumber" defaultValue={plant.registrationNumber || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="VIN Number" name="vinNumber" defaultValue={plant.vinNumber || ""} />
          <FormField label="Year" name="year" type="number" defaultValue={plant.year?.toString() || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Make" name="make" defaultValue={plant.make || ""} />
          <FormField label="Model" name="model" defaultValue={plant.model || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Licence Type Required" name="licenceType" defaultValue={plant.licenceType || ""} options={LICENCE_TYPE_OPTIONS} />
          <SelectField label="Region Assigned" name="regionAssigned" defaultValue={plant.regionAssigned || ""} options={LOCATION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Location" name="location" defaultValue={plant.location || ""} options={LOCATION_OPTIONS} />
          <SelectField label="Assigned To (Employee)" name="assignedToId" defaultValue={plant.assignedToId || ""} options={employees.map((emp) => ({
            value: emp.id,
            label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`,
          }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Ampol Card Number" name="ampolCardNumber" defaultValue={plant.ampolCardNumber || ""} />
          <FormField label="Ampol Card Expiry" name="ampolCardExpiry" type="date" defaultValue={formatDate(plant.ampolCardExpiry)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Linkt Tag Number" name="linktTagNumber" defaultValue={plant.linktTagNumber || ""} />
          <FormField label="Fleet Dynamics Serial Number" name="fleetDynamicsSerialNumber" defaultValue={plant.fleetDynamicsSerialNumber || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="COI Expiration Date" name="coiExpirationDate" type="date" defaultValue={formatDate(plant.coiExpirationDate)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Purchase Date" name="purchaseDate" type="date" defaultValue={formatDate(plant.purchaseDate)} />
          <FormField label="Purchase Price" name="purchasePrice" type="number" defaultValue={plant.purchasePrice?.toString() || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Sold Date" name="soldDate" type="date" defaultValue={formatDate(plant.soldDate)} />
          <FormField label="Sold Price" name="soldPrice" type="number" defaultValue={plant.soldPrice?.toString() || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Last Service Date" name="lastServiceDate" type="date" defaultValue={formatDate(plant.lastServiceDate)} />
          <FormField label="Next Service Due" name="nextServiceDue" type="date" defaultValue={formatDate(plant.nextServiceDue)} />
        </div>
        <TextAreaField label="Comments" name="comments" defaultValue={plant.comments || ""} />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
