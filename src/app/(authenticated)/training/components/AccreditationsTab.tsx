"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, TextAreaField } from "@/shared/components/FormField";

interface Accreditation {
  id: string;
  accreditationNumber: string;
  code: string | null;
  name: string;
  description: string | null;
  expires: boolean;
  renewalMonths: number | null;
  renewalNotes: string | null;
  isArchived: boolean;
}

const RENEWAL_OPTIONS = [
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "2 years" },
  { value: 36, label: "3 years" },
  { value: 60, label: "5 years" },
];

const columns: Column<Accreditation>[] = [
  { key: "accreditationNumber", label: "Accreditation #" },
  {
    key: "code",
    label: "Code",
    render: (item) => item.code || <span className="text-gray-400">—</span>,
  },
  { key: "name", label: "Name" },
  {
    key: "expires",
    label: "Expiry",
    render: (item) => {
      if (!item.expires) return <span className="text-gray-400">No expiry</span>;
      const period = RENEWAL_OPTIONS.find((o) => o.value === item.renewalMonths);
      return (
        <span className="text-amber-600 font-medium">
          Every {period ? period.label : `${item.renewalMonths}mo`}
        </span>
      );
    },
    hideOnMobile: true,
  },
  {
    key: "description",
    label: "Description",
    render: (item) => item.description || "—",
    hideOnMobile: true,
  },
];

export function AccreditationsTab() {
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Accreditation | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);

  // Expiry form state (shared between create and edit)
  const [formExpires, setFormExpires] = useState(false);
  const [formRenewalMonths, setFormRenewalMonths] = useState<number | "">("");
  const [formRenewalNotes, setFormRenewalNotes] = useState("");

  const loadAccreditations = useCallback((archived: boolean) => {
    setLoading(true);
    const url = archived ? "/api/training/accreditations?archived=true" : "/api/training/accreditations";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setAccreditations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadAccreditations(showArchived); }, [loadAccreditations, showArchived]);

  function resetExpiryForm() {
    setFormExpires(false);
    setFormRenewalMonths("");
    setFormRenewalNotes("");
  }

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
    resetExpiryForm();
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      code: (fd.get("code") as string) || null,
      description: fd.get("description") || null,
      expires: formExpires,
      renewalMonths: formExpires && formRenewalMonths ? Number(formRenewalMonths) : null,
      renewalNotes: formExpires ? (fd.get("renewalNotes") as string) || null : null,
    };
    const res = await fetch("/api/training/accreditations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create");
      return;
    }
    closeModal();
    loadAccreditations(showArchived);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      code: (fd.get("code") as string) || null,
      description: fd.get("description") || null,
      expires: formExpires,
      renewalMonths: formExpires && formRenewalMonths ? Number(formRenewalMonths) : null,
      renewalNotes: formExpires ? (fd.get("renewalNotes") as string) || null : null,
    };
    const res = await fetch(`/api/training/accreditations/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to update");
      return;
    }
    const updated = await res.json();
    setSelected(updated);
    setEditing(false);
    loadAccreditations(showArchived);
  }

  async function handleArchiveRestore() {
    if (!selected || !confirmAction) return;
    const action = confirmAction.type;
    const url = action === "archive"
      ? `/api/training/accreditations/${selected.id}`
      : `/api/training/accreditations/${selected.id}/restore`;
    const method = action === "archive" ? "DELETE" : "POST";
    await fetch(url, { method });
    setConfirmAction(null);
    closeModal();
    loadAccreditations(showArchived);
  }

  function ExpiryFields() {
    return (
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formExpires}
            onChange={(e) => setFormExpires(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">This accreditation expires</span>
        </label>
        {formExpires && (
          <div className="space-y-3 pl-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Period</label>
              <select
                value={formRenewalMonths}
                onChange={(e) => setFormRenewalMonths(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {RENEWAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <TextAreaField label="Renewal Notes" name="renewalNotes" defaultValue={formRenewalNotes} rows={2} placeholder="E.g. Must complete refresher course" />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
          Show archived
        </label>
        <button onClick={() => { resetExpiryForm(); setCreating(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
          + New Accreditation
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={accreditations} onRowClick={setSelected} emptyMessage="No accreditations found." />
      )}

      {/* Create Modal */}
      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-lg font-semibold mb-4">New Accreditation</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Name" name="name" required />
          <FormField label="Code" name="code" placeholder="e.g. HLTAID011" />
          <TextAreaField label="Description" name="description" />
          <ExpiryFields />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View / Edit Modal */}
      <Modal isOpen={!!selected} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500">{selected.accreditationNumber}</p>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFormExpires(selected.expires);
                    setFormRenewalMonths(selected.renewalMonths ?? "");
                    setFormRenewalNotes(selected.renewalNotes || "");
                    setEditing(true);
                  }}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmAction({ type: selected.isArchived ? "restore" : "archive" })}
                  className={`text-sm hover:underline ${selected.isArchived ? "text-green-600" : "text-red-600"}`}
                >
                  {selected.isArchived ? "Restore" : "Archive"}
                </button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {selected.code && <div><span className="text-gray-500">Code:</span> <span className="font-mono">{selected.code}</span></div>}
              {selected.description && <div><span className="text-gray-500">Description:</span> {selected.description}</div>}
              <div>
                <span className="text-gray-500">Expiry: </span>
                {selected.expires ? (
                  <span className="text-amber-600 font-medium">
                    Expires — renew every {RENEWAL_OPTIONS.find((o) => o.value === selected.renewalMonths)?.label || `${selected.renewalMonths} months`}
                  </span>
                ) : (
                  <span className="text-gray-600">Does not expire</span>
                )}
              </div>
              {selected.expires && selected.renewalNotes && (
                <div><span className="text-gray-500">Renewal Notes:</span> {selected.renewalNotes}</div>
              )}
            </div>
          </div>
        )}

        {selected && editing && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Edit Accreditation</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <FormField label="Name" name="name" required defaultValue={selected.name} />
              <FormField label="Code" name="code" defaultValue={selected.code || ""} placeholder="e.g. HLTAID011" />
              <TextAreaField label="Description" name="description" defaultValue={selected.description || ""} />
              <ExpiryFields />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === "archive" ? "Archive Accreditation" : "Restore Accreditation"}
        message={confirmAction?.type === "archive"
          ? `Archive "${selected?.name}"? It will be hidden from active views.`
          : `Restore "${selected?.name}"? It will appear in active views again.`}
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Restore"}
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={handleArchiveRestore}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
