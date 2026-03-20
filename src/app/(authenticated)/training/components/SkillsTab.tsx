"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, TextAreaField } from "@/shared/components/FormField";

interface Accreditation {
  id: string;
  accreditationNumber: string;
  name: string;
  isArchived?: boolean;
}

interface Skill {
  id: string;
  skillNumber: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  accreditationLinks: { accreditation: Accreditation }[];
  roleLinks: { role: { id: string; roleNumber: string; name: string } }[];
}

const columns: Column<Skill>[] = [
  { key: "skillNumber", label: "Skill #" },
  { key: "name", label: "Name" },
  {
    key: "accreditations",
    label: "Accreditations",
    render: (item) => `${item.accreditationLinks.length}`,
    hideOnMobile: true,
  },
  {
    key: "roles",
    label: "Roles",
    render: (item) => `${item.roleLinks.length}`,
    hideOnMobile: true,
  },
];

export function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);

  const [allAccreditations, setAllAccreditations] = useState<Accreditation[]>([]);
  const [linkAccredId, setLinkAccredId] = useState("");

  const loadSkills = useCallback((archived: boolean) => {
    setLoading(true);
    const url = archived ? "/api/training/skills?archived=true" : "/api/training/skills";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setSkills(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadSkills(showArchived); }, [loadSkills, showArchived]);

  useEffect(() => {
    fetch("/api/training/accreditations")
      .then((r) => r.json())
      .then(setAllAccreditations)
      .catch(() => {});
  }, []);

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = { name: fd.get("name"), description: fd.get("description") || null };
    const res = await fetch("/api/training/skills", {
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
    loadSkills(showArchived);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = { name: fd.get("name"), description: fd.get("description") || null };
    const res = await fetch(`/api/training/skills/${selected.id}`, {
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
    setSelected({ ...updated, accreditationLinks: selected.accreditationLinks, roleLinks: selected.roleLinks });
    setEditing(false);
    loadSkills(showArchived);
  }

  async function handleArchiveRestore() {
    if (!selected || !confirmAction) return;
    const action = confirmAction.type;
    const url = action === "archive"
      ? `/api/training/skills/${selected.id}`
      : `/api/training/skills/${selected.id}/restore`;
    const method = action === "archive" ? "DELETE" : "POST";
    await fetch(url, { method });
    setConfirmAction(null);
    closeModal();
    loadSkills(showArchived);
  }

  async function handleLinkAccreditation() {
    if (!selected || !linkAccredId) return;
    await fetch(`/api/training/skills/${selected.id}/accreditations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accreditationId: linkAccredId }),
    });
    setLinkAccredId("");
    const res = await fetch(`/api/training/skills/${selected.id}`);
    if (res.ok) setSelected(await res.json());
    loadSkills(showArchived);
  }

  async function handleUnlinkAccreditation(accreditationId: string) {
    if (!selected) return;
    await fetch(`/api/training/skills/${selected.id}/accreditations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accreditationId }),
    });
    const res = await fetch(`/api/training/skills/${selected.id}`);
    if (res.ok) setSelected(await res.json());
    loadSkills(showArchived);
  }

  const linkedAccredIds = new Set(selected?.accreditationLinks.map((l) => l.accreditation.id) || []);
  const availableAccreds = allAccreditations.filter((a) => !linkedAccredIds.has(a.id) && !a.isArchived);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
          Show archived
        </label>
        <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
          + New Skill
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={skills} onRowClick={setSelected} emptyMessage="No skills found." />
      )}

      {/* Create Modal */}
      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-lg font-semibold mb-4">New Skill</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Name" name="name" required />
          <TextAreaField label="Description" name="description" />
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
                <p className="text-xs text-gray-500">{selected.skillNumber}</p>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="text-blue-600 text-sm hover:underline">Edit</button>
                <button
                  onClick={() => setConfirmAction({ type: selected.isArchived ? "restore" : "archive" })}
                  className={`text-sm hover:underline ${selected.isArchived ? "text-green-600" : "text-red-600"}`}
                >
                  {selected.isArchived ? "Restore" : "Archive"}
                </button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {selected.description && <div><span className="text-gray-500">Description:</span> {selected.description}</div>}

              {/* Linked Roles (read-only) */}
              {selected.roleLinks.length > 0 && (
                <div className="pt-3 border-t">
                  <h3 className="font-medium mb-2">Used in Roles</h3>
                  <ul className="space-y-1">
                    {selected.roleLinks.map((link) => (
                      <li key={link.role.id} className="bg-gray-50 rounded px-3 py-1.5 text-sm">
                        {link.role.roleNumber} — {link.role.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linked Accreditations */}
              <div className="pt-3 border-t">
                <h3 className="font-medium mb-2">Required Accreditations</h3>
                {selected.accreditationLinks.length === 0 ? (
                  <p className="text-gray-400 text-sm">No accreditations linked.</p>
                ) : (
                  <ul className="space-y-1">
                    {selected.accreditationLinks.map((link) => (
                      <li key={link.accreditation.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5">
                        <span>{link.accreditation.accreditationNumber} — {link.accreditation.name}</span>
                        <button onClick={() => handleUnlinkAccreditation(link.accreditation.id)} className="text-red-500 text-xs hover:underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {availableAccreds.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <select value={linkAccredId} onChange={(e) => setLinkAccredId(e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm">
                      <option value="">Select an accreditation...</option>
                      {availableAccreds.map((a) => (
                        <option key={a.id} value={a.id}>{a.accreditationNumber} — {a.name}</option>
                      ))}
                    </select>
                    <button onClick={handleLinkAccreditation} disabled={!linkAccredId} className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">Add</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selected && editing && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Edit Skill</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <FormField label="Name" name="name" required defaultValue={selected.name} />
              <TextAreaField label="Description" name="description" defaultValue={selected.description || ""} />
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
        title={confirmAction?.type === "archive" ? "Archive Skill" : "Restore Skill"}
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
