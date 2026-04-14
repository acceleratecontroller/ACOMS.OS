"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import {
  PLANT_STATUS_OPTIONS as STATUS_OPTIONS,
  CONDITION_OPTIONS,
  LOCATION_OPTIONS,
  LOCATION_LABELS,
  STATE_OPTIONS,
  LICENCE_TYPE_OPTIONS,
  PLANT_CATEGORY_OPTIONS,
  PLANT_CATEGORY_LABELS,
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
  assetLinks?: LinkedAsset[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string | null;
  updatedByName?: string | null;
}

interface LinkedAsset {
  id: string;
  notes: string | null;
  asset: {
    id: string;
    assetNumber: string;
    name: string;
    category: string;
    status: string;
    condition: string | null;
  };
}

interface PlantOption {
  id: string;
  plantNumber: string;
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
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldSaving, setSoldSaving] = useState(false);
  const [soldError, setSoldError] = useState("");
  const [soldAssetActions, setSoldAssetActions] = useState<Record<string, string>>({});
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [activePlants, setActivePlants] = useState<PlantOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/plant/${id}`).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([plantData, empData]) => {
      setPlant(plantData);
      setEmployees(empData);
      if (plantData.assetLinks) setLinkedAssets(plantData.assetLinks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const form = new FormData(e.currentTarget);
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

  function openSoldModal() {
    setSoldError("");
    setSoldSaving(false);
    const actions: Record<string, string> = {};
    linkedAssets.forEach((link) => { actions[link.asset.id] = ""; });
    setSoldAssetActions(actions);
    // Load active plants for reassignment options
    fetch("/api/plant").then((r) => r.json()).then((data: PlantOption[]) => {
      setActivePlants(data.filter((p) => p.id !== id));
    });
    setShowSoldModal(true);
  }

  async function handleSold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const unresolved = linkedAssets.filter((link) => !soldAssetActions[link.asset.id]);
    if (unresolved.length > 0) {
      setSoldError("All linked assets must be reassigned or retired before marking as sold.");
      return;
    }

    setSoldSaving(true);
    setSoldError("");

    const form = new FormData(e.currentTarget);

    for (const link of linkedAssets) {
      const action = soldAssetActions[link.asset.id];
      if (action === "RETIRED") {
        await fetch(`/api/assets/${link.asset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RETIRED" }),
        });
        await fetch(`/api/plant/${id}/assets/${link.id}`, { method: "DELETE" });
      } else if (action.startsWith("REASSIGN:")) {
        const newPlantId = action.replace("REASSIGN:", "");
        await fetch(`/api/plant/${id}/assets/${link.id}`, { method: "DELETE" });
        await fetch(`/api/plant/${newPlantId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: link.asset.id, notes: link.notes || undefined }),
        });
      }
    }

    await fetch(`/api/plant/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soldDate: form.get("soldDate"),
        soldPrice: form.get("soldPrice"),
        comments: form.get("soldComments"),
      }),
    });

    const res = await fetch(`/api/plant/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/plant");
    } else {
      const data = await res.json();
      setSoldError(data.error || "Failed to mark as sold.");
    }
    setSoldSaving(false);
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
            <div><dt className="text-gray-500">Category</dt><dd className="font-medium">{PLANT_CATEGORY_LABELS[plant.category] || plant.category}</dd></div>
            <div><dt className="text-gray-500">State Registered</dt><dd className="font-medium">{plant.stateRegistered || "—"}</dd></div>
            <div><dt className="text-gray-500">Registration</dt><dd className="font-medium">{plant.registrationNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">VIN Number</dt><dd className="font-medium">{plant.vinNumber || "—"}</dd></div>
            <div><dt className="text-gray-500">Year</dt><dd className="font-medium">{plant.year || "—"}</dd></div>
            <div><dt className="text-gray-500">Make</dt><dd className="font-medium">{plant.make || "—"}</dd></div>
            <div><dt className="text-gray-500">Model</dt><dd className="font-medium">{plant.model || "—"}</dd></div>
            <div><dt className="text-gray-500">Licence Type</dt><dd className="font-medium">{plant.licenceType || "—"}</dd></div>
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
          {(plant.createdAt || plant.updatedAt) && (
            <p className="mt-6 text-xs text-gray-400">
              {plant.updatedAt && plant.createdAt && plant.updatedAt !== plant.createdAt
                ? `Last updated ${new Date(plant.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${plant.updatedByName ? ` by ${plant.updatedByName}` : ""} · `
                : ""}
              {plant.createdAt
                ? `Created ${new Date(plant.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${plant.createdByName ? ` by ${plant.createdByName}` : ""}`
                : ""}
            </p>
          )}
          <div className="flex gap-3 mt-4 pt-4 border-t">
            <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">Edit</button>
            {!plant.isArchived && <button onClick={openSoldModal} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Sold</button>}
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
          <SelectField label="Category" name="category" required defaultValue={plant.category} options={PLANT_CATEGORY_OPTIONS} />
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
          <SelectField label="Location" name="location" defaultValue={plant.location || ""} options={LOCATION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
          {!plant.isArchived && <><div className="flex-1" /><button type="button" onClick={openSoldModal} className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50">Sold</button></>}
        </div>
      </form>

      {/* Sold Modal */}
      <Modal isOpen={showSoldModal} onClose={() => setShowSoldModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Mark as Sold</h2>
        <p className="text-sm text-gray-500 mb-4">Record sale details for <strong>{plant.plantNumber}</strong>.</p>

        {linkedAssets.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              This plant has {linkedAssets.length} linked asset{linkedAssets.length !== 1 ? "s" : ""} that must be dealt with before it can be sold:
            </p>
            <div className="space-y-2">
              {linkedAssets.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded border text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{link.asset.name}</span>
                    <span className="text-gray-500 ml-1">({link.asset.assetNumber})</span>
                  </div>
                  <select
                    value={soldAssetActions[link.asset.id] || ""}
                    onChange={(e) => setSoldAssetActions({ ...soldAssetActions, [link.asset.id]: e.target.value })}
                    className="text-sm border border-gray-300 rounded px-2 py-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select action --</option>
                    <option value="RETIRED">Retire asset</option>
                    {activePlants.map((p) => (
                      <option key={p.id} value={`REASSIGN:${p.id}`}>Reassign to {p.plantNumber}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSold} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sold Date" name="soldDate" type="date" required />
            <FormField label="Sold Price" name="soldPrice" type="number" placeholder="0.00" />
          </div>
          <TextAreaField label="Comments" name="soldComments" defaultValue={plant.comments || ""} placeholder="Optional comments about the sale..." />
          {soldError && <p className="text-red-500 text-sm">{soldError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={soldSaving} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              {soldSaving ? "Processing..." : "Confirm Sale"}
            </button>
            <button type="button" onClick={() => setShowSoldModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
