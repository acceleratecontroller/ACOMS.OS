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
  CONDITION_OPTIONS,
} from "@/config/constants";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
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
  // Open a specific record if ?open=id is in the URL (from global search)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      router.replace(window.location.pathname, { scroll: false });

      fetch(`/api/plant/${openId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setSelected(data); });
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

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
  }

  function getFormBody(form: FormData) {
    return {
      plantNumber: form.get("plantNumber"),
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
    if (res.ok) { closeModal(); loadData(showArchived); }
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
          <FormField label="Plant Number" name="plantNumber" required placeholder="e.g. PLT-001" defaultValue={defaults?.plantNumber || ""} />
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
          <FormField label="Location" name="location" placeholder="e.g. Site B" defaultValue={defaults?.location || ""} />
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
        <DataTable columns={columns} data={plant} onRowClick={(p) => { setSelected(p); setEditing(false); }} emptyMessage={showArchived ? "No archived plant items." : "No plant items found. Click '+ Add Plant' to create one."} />
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
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Plant #</dt><dd className="font-medium text-gray-900">{selected.plantNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Category</dt><dd className="font-medium text-gray-900">{selected.category}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Make</dt><dd className="font-medium text-gray-900">{selected.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Model</dt><dd className="font-medium text-gray-900">{selected.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Serial Number</dt><dd className="font-medium text-gray-900">{selected.serialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Year</dt><dd className="font-medium text-gray-900">{selected.yearOfManufacture || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Registration</dt><dd className="font-medium text-gray-900">{selected.registrationNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Location</dt><dd className="font-medium text-gray-900">{selected.location || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.purchaseDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Purchase Cost</dt><dd className="font-medium text-gray-900">{selected.purchaseCost ? `$${selected.purchaseCost}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Last Service</dt><dd className="font-medium text-gray-900">{formatDate(selected.lastServiceDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Next Service Due</dt><dd className="font-medium text-gray-900">{formatDate(selected.nextServiceDue) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider mb-1">Assigned To</dt><dd className="font-medium text-gray-900">{selected.assignedTo ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}` : "—"}</dd></div>
            </dl>
            {selected.notes && (
              <div className="mt-5 text-sm"><p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>
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
            <h2 className="text-xl font-bold text-gray-900 mb-5">Edit Plant</h2>
            <PlantForm defaults={selected} onSubmit={handleUpdate} submitLabel="Save Changes" onArchive={() => setConfirmAction({ type: "archive" })} />
          </div>
        )}
      </Modal>

      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Add Plant</h2>
        <PlantForm onSubmit={handleCreate} submitLabel="Create Plant Item" />
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === "archive" ? "Archive Plant" : "Restore Plant"}
        message={confirmAction?.type === "archive"
          ? "Are you sure you want to archive this plant item? It will be moved to the archived list."
          : "Are you sure you want to restore this plant item? It will be moved back to the active list."}
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Restore"}
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={confirmAction?.type === "archive" ? handleArchive : handleRestore}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
