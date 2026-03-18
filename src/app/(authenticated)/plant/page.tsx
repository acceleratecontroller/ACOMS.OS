"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import {
  PLANT_STATUS_OPTIONS as STATUS_OPTIONS,
  ASSET_STATUS_OPTIONS,
  CONDITION_OPTIONS,
  LOCATION_OPTIONS,
  LOCATION_LABELS,
} from "@/config/constants";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface LinkedAsset {
  id: string; // link ID
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

interface AvailableAsset {
  id: string;
  assetNumber: string;
  name: string;
  category: string;
  status: string;
}

interface PlantItem {
  id: string;
  plantNumber: string;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  yearOfManufacture: number | null;
  registrationNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  location: string | null;
  status: string;
  condition: string | null;
  lastServiceDate: string | null;
  nextServiceDue: string | null;
  notes: string | null;
  isArchived: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
  assetLinks?: LinkedAsset[];
}

const columns: Column<PlantItem>[] = [
  { key: "plantNumber", label: "Plant #" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "registrationNumber", label: "Rego" },
  { key: "location", label: "Location" },
  {
    key: "assignedTo",
    label: "Assigned To",
    render: (item) => item.assignedTo ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}` : "—",
  },
  {
    key: "status",
    label: "Status",
    render: (item) => <StatusBadge status={item.status} />,
  },
];

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

export default function PlantPage() {
  return <Suspense><PlantContent /></Suspense>;
}

function PlantContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plant, setPlant] = useState<PlantItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlantItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);

  // Linked assets state
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkingAssetId, setLinkingAssetId] = useState<string | null>(null);
  const [linkNotes, setLinkNotes] = useState("");
  const [linkError, setLinkError] = useState("");
  const [unlinkConfirm, setUnlinkConfirm] = useState<LinkedAsset | null>(null);

  // Open a specific record if ?open=id is in the URL (from global search)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      router.replace(window.location.pathname, { scroll: false });

      fetch(`/api/plant/${openId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setSelected(data);
            if (data.assetLinks) setLinkedAssets(data.assetLinks);
          }
        });
    }
  }, [searchParams, router]);

  const loadData = useCallback((archived: boolean) => {
    setLoading(true);
    const plantUrl = archived ? "/api/plant?archived=true" : "/api/plant";
    Promise.all([
      fetch(plantUrl).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([plantData, empData]) => {
      setPlant(plantData);
      setEmployees(empData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(showArchived); }, [loadData, showArchived]);

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeNumber})`,
  }));

  // Load linked assets when a plant is selected (full detail from API)
  function loadPlantDetail(plantId: string) {
    fetch(`/api/plant/${plantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setSelected(data);
          setLinkedAssets(data.assetLinks || []);
        }
      });
  }

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
    setLinkedAssets([]);
  }

  // Load available (unlinked to this plant) assets for linking
  function openLinkModal() {
    setShowLinkModal(true);
    setLinkSearch("");
    setLinkingAssetId(null);
    setLinkNotes("");
    setLinkError("");
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => {
        // Filter out assets already linked to this plant
        const linkedIds = new Set(linkedAssets.map((l) => l.asset.id));
        setAvailableAssets(
          (data as AvailableAsset[]).filter((a) => !linkedIds.has(a.id))
        );
      });
  }

  async function handleLinkExisting() {
    if (!selected || !linkingAssetId) return;
    setLinkError("");
    const res = await fetch(`/api/plant/${selected.id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: linkingAssetId, notes: linkNotes || undefined }),
    });
    if (res.ok) {
      setShowLinkModal(false);
      loadPlantDetail(selected.id);
    } else {
      const data = await res.json();
      setLinkError(data.error || "Failed to link asset");
    }
  }

  async function handleCreateAndLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setLinkError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/plant/${selected.id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        create: {
          name: form.get("name"),
          category: form.get("category"),
          make: form.get("make"),
          model: form.get("model"),
          serialNumber: form.get("serialNumber"),
          status: form.get("status"),
          condition: form.get("condition"),
          notes: form.get("assetNotes"),
        },
        notes: form.get("linkNotes") || undefined,
      }),
    });
    if (res.ok) {
      setShowCreateAssetModal(false);
      loadPlantDetail(selected.id);
    } else {
      const data = await res.json();
      setLinkError(data.error || "Failed to create and link asset");
    }
  }

  async function handleUnlink() {
    if (!selected || !unlinkConfirm) return;
    const res = await fetch(`/api/plant/${selected.id}/assets/${unlinkConfirm.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUnlinkConfirm(null);
      loadPlantDetail(selected.id);
    }
  }

  function getFormBody(form: FormData) {
    return {
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
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getFormBody(new FormData(e.currentTarget))),
    });
    if (res.ok) {
      const created = await res.json();
      setCreating(false);
      setError("");
      loadData(showArchived);
      loadPlantDetail(created.id);
    }
    else { const data = await res.json(); setError(data.error || "Failed to create."); }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    const res = await fetch(`/api/plant/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getFormBody(new FormData(e.currentTarget))),
    });
    if (res.ok) { closeModal(); loadData(showArchived); }
    else { const data = await res.json(); setError(data.error || "Failed to update."); }
    setSaving(false);
  }

  async function handleArchive() {
    if (!selected) return;
    const res = await fetch(`/api/plant/${selected.id}`, { method: "DELETE" });
    if (res.ok) { setConfirmAction(null); closeModal(); loadData(showArchived); }
    else {
      const data = await res.json();
      setError(data.error || "Failed to archive.");
      setConfirmAction(null);
    }
  }

  async function handleRestore() {
    if (!selected) return;
    const res = await fetch(`/api/plant/${selected.id}/restore`, { method: "POST" });
    if (res.ok) { setConfirmAction(null); closeModal(); loadData(showArchived); }
  }

  function PlantForm({ defaults, onSubmit, submitLabel, onArchive }: { defaults?: PlantItem; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; submitLabel: string; onArchive?: () => void }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaults?.plantNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plant Number</label>
              <p className="text-sm font-medium text-gray-900 py-2">{defaults.plantNumber}</p>
            </div>
          )}
          <SelectField label="Status" name="status" required defaultValue={defaults?.status || "OPERATIONAL"} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" name="name" required placeholder="e.g. CAT 320 Excavator" defaultValue={defaults?.name || ""} />
          <FormField label="Category" name="category" required placeholder="e.g. Excavator" defaultValue={defaults?.category || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Make" name="make" placeholder="e.g. Caterpillar" defaultValue={defaults?.make || ""} />
          <FormField label="Model" name="model" placeholder="e.g. 320" defaultValue={defaults?.model || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Serial Number" name="serialNumber" defaultValue={defaults?.serialNumber || ""} />
          <FormField label="Year of Manufacture" name="yearOfManufacture" type="number" placeholder="e.g. 2020" defaultValue={defaults?.yearOfManufacture?.toString() || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Registration Number" name="registrationNumber" placeholder="e.g. ABC-123" defaultValue={defaults?.registrationNumber || ""} />
          <SelectField label="Condition" name="condition" defaultValue={defaults?.condition || ""} options={CONDITION_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Purchase Date" name="purchaseDate" type="date" defaultValue={formatDate(defaults?.purchaseDate || null)} />
          <FormField label="Purchase Cost" name="purchaseCost" type="number" placeholder="0.00" defaultValue={defaults?.purchaseCost?.toString() || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Location" name="location" defaultValue={defaults?.location || ""} options={LOCATION_OPTIONS} />
          <SelectField label="Assigned To" name="assignedToId" defaultValue={defaults?.assignedToId || ""} options={employeeOptions} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Last Service Date" name="lastServiceDate" type="date" defaultValue={formatDate(defaults?.lastServiceDate || null)} />
          <FormField label="Next Service Due" name="nextServiceDue" type="date" defaultValue={formatDate(defaults?.nextServiceDue || null)} />
        </div>
        <TextAreaField label="Notes" name="notes" defaultValue={defaults?.notes || ""} placeholder="Optional notes..." />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-3">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? "Saving..." : submitLabel}</button>
          <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          {onArchive && <><div className="flex-1" /><button type="button" onClick={onArchive} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">Archive</button></>}
        </div>
      </form>
    );
  }

  // Filtered assets for link search
  const filteredAvailable = availableAssets.filter((a) => {
    if (!linkSearch) return true;
    const q = linkSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.assetNumber.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader title="Plant Register" description="Manage cars, trucks, excavators, and heavy equipment." />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showArchived ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showArchived ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Archived
          </button>
        </div>
        {!showArchived && (
          <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Add Plant</button>
        )}
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <DataTable columns={columns} data={plant} onRowClick={(p) => { loadPlantDetail(p.id); setEditing(false); }} emptyMessage={showArchived ? "No archived plant items." : "No plant items found. Click '+ Add Plant' to create one."} />
      )}

      {/* Detail / Edit Modal */}
      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
              <StatusBadge status={selected.status} />
              {selected.condition && <StatusBadge status={selected.condition} />}
              {selected.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Archived</span>
              )}
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 md:gap-y-5 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Plant #</dt><dd className="font-medium text-gray-900">{selected.plantNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Category</dt><dd className="font-medium text-gray-900">{selected.category}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Make</dt><dd className="font-medium text-gray-900">{selected.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Model</dt><dd className="font-medium text-gray-900">{selected.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Serial Number</dt><dd className="font-medium text-gray-900">{selected.serialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Year</dt><dd className="font-medium text-gray-900">{selected.yearOfManufacture || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Registration</dt><dd className="font-medium text-gray-900">{selected.registrationNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Location</dt><dd className="font-medium text-gray-900">{selected.location ? (LOCATION_LABELS[selected.location] || selected.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.purchaseDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Cost</dt><dd className="font-medium text-gray-900">{selected.purchaseCost ? `$${selected.purchaseCost}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Last Service</dt><dd className="font-medium text-gray-900">{formatDate(selected.lastServiceDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Next Service Due</dt><dd className="font-medium text-gray-900">{formatDate(selected.nextServiceDue) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Assigned To</dt><dd className="font-medium text-gray-900">{selected.assignedTo ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}` : "—"}</dd></div>
            </dl>
            {selected.notes && (
              <div className="mt-5 text-sm"><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>
            )}

            {/* Linked Assets Section */}
            <div className="mt-6 pt-5 border-t">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Linked Assets</h3>
                {!selected.isArchived && (
                  <div className="flex gap-2">
                    <button onClick={openLinkModal} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      + Link Existing
                    </button>
                    <button onClick={() => { setShowCreateAssetModal(true); setLinkError(""); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      + Create New
                    </button>
                  </div>
                )}
              </div>
              {linkedAssets.length === 0 ? (
                <p className="text-sm text-gray-400">No assets linked to this plant item.</p>
              ) : (
                <div className="space-y-2">
                  {linkedAssets.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{link.asset.name}</span>
                        <span className="text-gray-500 ml-2">({link.asset.assetNumber})</span>
                        <span className="text-gray-400 ml-2">{link.asset.category}</span>
                        {link.notes && <p className="text-xs text-gray-500 mt-0.5">{link.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <StatusBadge status={link.asset.status} />
                        {!selected.isArchived && (
                          <button
                            onClick={() => setUnlinkConfirm(link)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 pt-5 border-t">
              {selected.isArchived ? (
                <button onClick={() => setConfirmAction({ type: "restore" })} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Restore</button>
              ) : (
                <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Edit</button>
              )}
            </div>
          </div>
        )}
        {selected && editing && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Edit Plant</h2>
            <PlantForm defaults={selected} onSubmit={handleUpdate} submitLabel="Save Changes" onArchive={() => setConfirmAction({ type: "archive" })} />
          </div>
        )}
      </Modal>

      {/* Create Plant Modal */}
      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Add Plant</h2>
        <PlantForm onSubmit={handleCreate} submitLabel="Create Plant Item" />
      </Modal>

      {/* Link Existing Asset Modal */}
      <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Link Existing Asset</h2>
        <p className="text-sm text-gray-500 mb-4">
          Search for an asset to link to <strong>{selected?.name}</strong>.
        </p>
        <input
          type="text"
          placeholder="Search by name, number, or category..."
          value={linkSearch}
          onChange={(e) => setLinkSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="max-h-48 overflow-y-auto border rounded mb-3">
          {filteredAvailable.length === 0 ? (
            <p className="text-sm text-gray-400 p-3">No available assets found.</p>
          ) : (
            filteredAvailable.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setLinkingAssetId(a.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-blue-50 transition-colors ${
                  linkingAssetId === a.id ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className="text-gray-500 ml-2">({a.assetNumber})</span>
                <span className="text-gray-400 ml-2">{a.category}</span>
              </button>
            ))
          )}
        </div>
        <TextAreaField
          label="Link Notes (optional)"
          name="linkNotes"
          value={linkNotes}
          onChange={(e) => setLinkNotes(e.target.value)}
          placeholder="e.g. Mounted behind driver seat"
        />
        {linkError && <p className="text-red-500 text-sm mt-2">{linkError}</p>}
        <div className="flex gap-3 pt-3">
          <button
            type="button"
            disabled={!linkingAssetId}
            onClick={handleLinkExisting}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Link Asset
          </button>
          <button type="button" onClick={() => setShowLinkModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </Modal>

      {/* Create New Asset + Link Modal */}
      <Modal isOpen={showCreateAssetModal} onClose={() => setShowCreateAssetModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create & Link New Asset</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a new asset and automatically link it to <strong>{selected?.name}</strong>.
        </p>
        <form onSubmit={handleCreateAndLink} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Status" name="status" required defaultValue="IN_USE" options={ASSET_STATUS_OPTIONS} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Name" name="name" required placeholder="e.g. First Aid Kit" />
            <FormField label="Category" name="category" required placeholder="e.g. Safety Equipment" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Make" name="make" placeholder="e.g. St John" />
            <FormField label="Model" name="model" placeholder="e.g. Vehicle Kit" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Serial Number" name="serialNumber" />
            <SelectField label="Condition" name="condition" defaultValue="" options={CONDITION_OPTIONS} />
          </div>
          <TextAreaField label="Asset Notes" name="assetNotes" placeholder="Optional notes about the asset..." />
          <TextAreaField label="Link Notes" name="linkNotes" placeholder="e.g. Located under passenger seat" />
          {linkError && <p className="text-red-500 text-sm">{linkError}</p>}
          <div className="flex gap-3 pt-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Create & Link</button>
            <button type="button" onClick={() => setShowCreateAssetModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Unlink Confirmation */}
      <ConfirmDialog
        isOpen={!!unlinkConfirm}
        title="Unlink Asset"
        message={unlinkConfirm ? `Are you sure you want to unlink "${unlinkConfirm.asset.name}" from this plant item? The asset will remain in the asset register but will no longer be associated with this plant.` : ""}
        confirmLabel="Unlink"
        confirmVariant="danger"
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkConfirm(null)}
      />

      {/* Archive / Restore Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === "archive" ? "Archive Plant" : "Restore Plant"}
        message={confirmAction?.type === "archive"
          ? linkedAssets.length > 0
            ? `This plant item has ${linkedAssets.length} linked asset${linkedAssets.length !== 1 ? "s" : ""}. Archiving will NOT remove the linked assets — you should unlink or reassign them first. Are you sure you want to archive this plant item?`
            : "Are you sure you want to archive this plant item? It will be moved to the archived list."
          : "Are you sure you want to restore this plant item? It will be moved back to the active list."}
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Restore"}
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={confirmAction?.type === "archive" ? handleArchive : handleRestore}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
