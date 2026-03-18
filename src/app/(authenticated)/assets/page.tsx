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
  ASSET_STATUS_OPTIONS as STATUS_OPTIONS,
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

interface PlantLink {
  id: string;
  plant: { id: string; plantNumber: string; name: string };
}

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
  plantLinks?: PlantLink[];
}

const columns: Column<Asset>[] = [
  { key: "assetNumber", label: "Asset #" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
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

export default function AssetsPage() {
  return <Suspense><AssetsContent /></Suspense>;
}

function AssetsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);
  // Open a specific record if ?open=id is in the URL (from global search)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      router.replace(window.location.pathname, { scroll: false });

      fetch(`/api/assets/${openId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setSelected(data); });
    }
  }, [searchParams, router]);

  const loadData = useCallback((archived: boolean) => {
    setLoading(true);
    const assetUrl = archived ? "/api/assets?archived=true" : "/api/assets";
    Promise.all([
      fetch(assetUrl).then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([assetData, empData]) => {
      setAssets(assetData);
      setEmployees(empData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(showArchived); }, [loadData, showArchived]);

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeNumber})`,
  }));

  // Load full asset detail (includes plantLinks)
  function loadAssetDetail(assetId: string) {
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSelected(data); });
  }

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
  }

  function getFormBody(form: FormData) {
    return {
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
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getFormBody(new FormData(e.currentTarget))),
    });
    if (res.ok) { closeModal(); loadData(showArchived); }
    else { const data = await res.json(); setError(data.error || "Failed to create."); }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    const res = await fetch(`/api/assets/${selected.id}`, {
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
    const res = await fetch(`/api/assets/${selected.id}`, { method: "DELETE" });
    if (res.ok) { setConfirmAction(null); closeModal(); loadData(showArchived); }
  }

  async function handleRestore() {
    if (!selected) return;
    const res = await fetch(`/api/assets/${selected.id}/restore`, { method: "POST" });
    if (res.ok) { setConfirmAction(null); closeModal(); loadData(showArchived); }
  }

  function AssetForm({ defaults, onSubmit, submitLabel, onArchive }: { defaults?: Asset; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; submitLabel: string; onArchive?: () => void }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaults?.assetNumber ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Number</label>
              <p className="text-sm font-medium text-gray-900 py-2">{defaults.assetNumber}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Number</label>
              <p className="text-sm text-gray-500 py-2">Auto-generated</p>
            </div>
          )}
          <SelectField label="Status" name="status" required defaultValue={defaults?.status || "AVAILABLE"} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" name="name" required placeholder="e.g. Makita Impact Drill" defaultValue={defaults?.name || ""} />
          <FormField label="Category" name="category" required placeholder="e.g. Power Tool" defaultValue={defaults?.category || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Make" name="make" placeholder="e.g. Makita" defaultValue={defaults?.make || ""} />
          <FormField label="Model" name="model" placeholder="e.g. DTD172" defaultValue={defaults?.model || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Serial Number" name="serialNumber" defaultValue={defaults?.serialNumber || ""} />
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

  return (
    <div>
      <PageHeader title="Asset Register" description="Track tools, phones, laptops, PPE, and other portable items." />
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
          <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Add Asset</button>
        )}
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <DataTable columns={columns} data={assets} onRowClick={(a) => { loadAssetDetail(a.id); setEditing(false); }} emptyMessage={showArchived ? "No archived assets." : "No assets found. Click '+ Add Asset' to create one."} />
      )}

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
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Asset #</dt><dd className="font-medium text-gray-900">{selected.assetNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Category</dt><dd className="font-medium text-gray-900">{selected.category}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Make</dt><dd className="font-medium text-gray-900">{selected.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Model</dt><dd className="font-medium text-gray-900">{selected.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Serial Number</dt><dd className="font-medium text-gray-900">{selected.serialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Location</dt><dd className="font-medium text-gray-900">{selected.location ? (LOCATION_LABELS[selected.location] || selected.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.purchaseDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Cost</dt><dd className="font-medium text-gray-900">{selected.purchaseCost ? `$${selected.purchaseCost}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Assigned To</dt><dd className="font-medium text-gray-900">{selected.assignedTo ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}` : "—"}</dd></div>
            </dl>
            {selected.notes && (
              <div className="mt-5 text-sm"><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>
            )}
            {/* Linked Plant Info */}
            {selected.plantLinks && selected.plantLinks.length > 0 && (
              <div className="mt-5 pt-4 border-t">
                <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Linked to Plant</h3>
                <div className="space-y-1">
                  {selected.plantLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-2 text-sm">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                      <span className="font-medium text-gray-900">{link.plant.name}</span>
                      <span className="text-gray-500">({link.plant.plantNumber})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <h2 className="text-xl font-bold text-gray-900 mb-5">Edit Asset</h2>
            <AssetForm defaults={selected} onSubmit={handleUpdate} submitLabel="Save Changes" onArchive={() => setConfirmAction({ type: "archive" })} />
          </div>
        )}
      </Modal>

      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Add Asset</h2>
        <AssetForm onSubmit={handleCreate} submitLabel="Create Asset" />
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === "archive" ? "Archive Asset" : "Restore Asset"}
        message={confirmAction?.type === "archive"
          ? "Are you sure you want to archive this asset? It will be moved to the archived list."
          : "Are you sure you want to restore this asset? It will be moved back to the active list."}
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Restore"}
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={confirmAction?.type === "archive" ? handleArchive : handleRestore}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
