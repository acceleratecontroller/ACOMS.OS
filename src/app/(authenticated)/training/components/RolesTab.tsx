"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import { TRAINING_ROLE_CATEGORY_OPTIONS } from "@/config/constants";

interface Skill {
  id: string;
  skillNumber: string;
  name: string;
  isArchived?: boolean;
}

interface Role {
  id: string;
  roleNumber: string;
  name: string;
  description: string | null;
  category: string;
  isArchived: boolean;
  skillLinks: { skill: Skill }[];
}

const columns: Column<Role>[] = [
  { key: "roleNumber", label: "Role #" },
  { key: "name", label: "Name" },
  {
    key: "category",
    label: "Category",
    render: (item) => (item.category === "OFFICE" ? "Office" : "Field"),
    hideOnMobile: true,
  },
  {
    key: "skills",
    label: "Skills",
    render: (item) => `${item.skillLinks.length} skill${item.skillLinks.length !== 1 ? "s" : ""}`,
    hideOnMobile: true,
  },
];

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);

  // Skills for linking
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [linkSkillId, setLinkSkillId] = useState("");

  const loadRoles = useCallback((archived: boolean) => {
    setLoading(true);
    const url = archived ? "/api/training/roles?archived=true" : "/api/training/roles";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setRoles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadRoles(showArchived); }, [loadRoles, showArchived]);

  useEffect(() => {
    fetch("/api/training/skills")
      .then((r) => r.json())
      .then(setAllSkills)
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
    const body = {
      name: fd.get("name"),
      description: fd.get("description") || null,
      category: fd.get("category"),
    };
    const res = await fetch("/api/training/roles", {
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
    loadRoles(showArchived);
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      description: fd.get("description") || null,
      category: fd.get("category"),
    };
    const res = await fetch(`/api/training/roles/${selected.id}`, {
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
    setSelected({ ...updated, skillLinks: selected.skillLinks });
    setEditing(false);
    loadRoles(showArchived);
  }

  async function handleArchiveRestore() {
    if (!selected || !confirmAction) return;
    const action = confirmAction.type;
    const url =
      action === "archive"
        ? `/api/training/roles/${selected.id}`
        : `/api/training/roles/${selected.id}/restore`;
    const method = action === "archive" ? "DELETE" : "POST";
    await fetch(url, { method });
    setConfirmAction(null);
    closeModal();
    loadRoles(showArchived);
  }

  async function handleLinkSkill() {
    if (!selected || !linkSkillId) return;
    await fetch(`/api/training/roles/${selected.id}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId: linkSkillId }),
    });
    setLinkSkillId("");
    // Reload the selected role
    const res = await fetch(`/api/training/roles/${selected.id}`);
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
    }
    loadRoles(showArchived);
  }

  async function handleUnlinkSkill(skillId: string) {
    if (!selected) return;
    await fetch(
      `/api/training/roles/${selected.id}/skills?skillId=${encodeURIComponent(skillId)}`,
      { method: "DELETE" },
    );
    const res = await fetch(`/api/training/roles/${selected.id}`);
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
    }
    loadRoles(showArchived);
  }

  const linkedSkillIds = new Set(selected?.skillLinks.map((l) => l.skill.id) || []);
  const availableSkills = allSkills.filter((s) => !linkedSkillIds.has(s.id) && !s.isArchived);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          + New Role
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <DataTable columns={columns} data={roles} onRowClick={setSelected} emptyMessage="No roles found." />
      )}

      {/* Create Modal */}
      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-lg font-semibold mb-4">New Role</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Name" name="name" required />
          <SelectField label="Category" name="category" options={TRAINING_ROLE_CATEGORY_OPTIONS} required />
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
                <p className="text-xs text-gray-500">{selected.roleNumber}</p>
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
              <div><span className="text-gray-500">Category:</span> {selected.category === "OFFICE" ? "Office" : "Field"}</div>
              {selected.description && <div><span className="text-gray-500">Description:</span> {selected.description}</div>}

              {/* Linked Skills */}
              <div className="pt-3 border-t">
                <h3 className="font-medium mb-2">Linked Skills</h3>
                {selected.skillLinks.length === 0 ? (
                  <p className="text-gray-400 text-sm">No skills linked.</p>
                ) : (
                  <ul className="space-y-1">
                    {selected.skillLinks.map((link) => (
                      <li key={link.skill.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5">
                        <span>{link.skill.skillNumber} — {link.skill.name}</span>
                        <button onClick={() => handleUnlinkSkill(link.skill.id)} className="text-red-500 text-xs hover:underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {availableSkills.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <select
                      value={linkSkillId}
                      onChange={(e) => setLinkSkillId(e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    >
                      <option value="">Select a skill...</option>
                      {availableSkills.map((s) => (
                        <option key={s.id} value={s.id}>{s.skillNumber} — {s.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleLinkSkill}
                      disabled={!linkSkillId}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selected && editing && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Edit Role</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <FormField label="Name" name="name" required defaultValue={selected.name} />
              <SelectField label="Category" name="category" options={TRAINING_ROLE_CATEGORY_OPTIONS} required defaultValue={selected.category} />
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
        title={confirmAction?.type === "archive" ? "Archive Role" : "Restore Role"}
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
