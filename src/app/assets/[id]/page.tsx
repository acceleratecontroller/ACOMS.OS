"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  location: string | null;
  status: string;
  condition: string | null;
  notes: string | null;
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

export default function AssetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/assets/${id}`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([assetData, empData]) => {
      setAsset(assetData);
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
      assetNumber: form.get("assetNumber"),
      name: form.get("name"),
      category: form.get("category"),
      make: form.get("make"),
      model: form.get("model"),
      serialNumber: form.get("serialNumber"),
      purchaseDate: form.get("purchaseDate"),
      purchaseCost: form.get("purchaseCost"),
      location: form.get("location"),
      assignedToId: form.get("assignedToId"),
      status: form.get("status"),
      condition: form.get("condition"),
      notes: form.get("notes"),
    };

    const res = await fetch(`/api/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      setAsset(updated);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to update.");
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this asset?")) return;
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/assets");
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!asset) return <p className="text-sm text-red-500">Asset not found.</p>;

  const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

  if (!editing) {
    return (
      <div>
        <PageHeader title={asset.name} />
        <div className="max-w-2xl bg-white rounded border p-6">
          <div className="flex gap-2 mb-6">
            <StatusBadge status={asset.status} />
            {asset.condition && <StatusBadge status={asset.condition} />}
            {asset.isArchived && <StatusBadge status="ARCHIVED" />}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><dt className="text-gray-500">Asset #</dt><dd className="font-medium">{asset.assetNumber}</dd></div>
            <div><dt className="text-gray-500">Category</dt><dd className="font-medium">{asset.category}</dd></div>
            <div><dt className="text-gray-500">Make</dt><dd className="font-medium">{asset.make || "—"}</dd></div>
            <div><dt className="text-gray-500">Model</dt><dd className="font-medium">{asset.model || "—"}</dd></div>
            <div><dt className="text-gray-500">Serial Number</dt><dd className="font-medium">{asset.serialNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">Location</dt><dd className="font-medium">{asset.location || "—"}</dd></div>
            <div><dt className="text-gray-500">Purchase Date</dt><dd className="font-medium">{formatDate(asset.purchaseDate) || "—"}</dd></div>
            <div><dt className="text-gray-500">Purchase Cost</dt><dd className="font-medium">{asset.purchaseCost ? `$${asset.purchaseCost}` : "—"}</dd></div>
            <div><dt className="text-gray-500">Assigned To</dt><dd className="font-medium">{asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName} (${asset.assignedTo.employeeNumber})` : "—"}</dd></div>
          </dl>
          {asset.notes && (
            <div className="mt-4 text-sm">
              <p className="text-gray-500 mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{asset.notes}</p>
            </div>
          )}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Edit</button>
            <button onClick={handleArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Archive</button>
            <button onClick={() => router.push("/assets")} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50">Back to list</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Edit: ${asset.name}`} />
      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Asset Number" name="assetNumber" required defaultValue={asset.assetNumber} />
          <SelectField label="Status" name="status" required defaultValue={asset.status} options={[
            { value: "AVAILABLE", label: "Available" },
            { value: "IN_USE", label: "In Use" },
            { value: "MAINTENANCE", label: "Maintenance" },
            { value: "RETIRED", label: "Retired" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" name="name" required defaultValue={asset.name} />
          <FormField label="Category" name="category" required defaultValue={asset.category} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Make" name="make" defaultValue={asset.make || ""} />
          <FormField label="Model" name="model" defaultValue={asset.model || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Serial Number" name="serialNumber" defaultValue={asset.serialNumber || ""} />
          <SelectField label="Condition" name="condition" defaultValue={asset.condition || ""} options={[
            { value: "NEW", label: "New" },
            { value: "GOOD", label: "Good" },
            { value: "FAIR", label: "Fair" },
            { value: "POOR", label: "Poor" },
          ]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Purchase Date" name="purchaseDate" type="date" defaultValue={formatDate(asset.purchaseDate)} />
          <FormField label="Purchase Cost" name="purchaseCost" type="number" defaultValue={asset.purchaseCost?.toString() || ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Location" name="location" defaultValue={asset.location || ""} />
          <SelectField label="Assigned To (Employee)" name="assignedToId" defaultValue={asset.assignedToId || ""} options={employees.map((emp) => ({
            value: emp.id,
            label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`,
          }))} />
        </div>
        <TextAreaField label="Notes" name="notes" defaultValue={asset.notes || ""} />

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
