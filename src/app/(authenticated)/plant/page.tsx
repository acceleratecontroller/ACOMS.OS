"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  STATE_OPTIONS,
  LICENCE_TYPE_OPTIONS,
  PLANT_CATEGORY_OPTIONS,
  PLANT_CATEGORY_LABELS,
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
}

// Base columns defined outside the component (no event handlers needed)
const baseColumns: Column<PlantItem>[] = [
  { key: "plantNumber", label: "Plant #" },
  { key: "category", label: "Category" },
  { key: "registrationNumber", label: "Rego" },
  {
    key: "make",
    label: "Make / Model",
    render: (item) => [item.make, item.model].filter(Boolean).join(" ") || "—",
  },
  {
    key: "location",
    label: "Location",
    render: (item) => item.location ? (LOCATION_LABELS[item.location] || item.location) : "—",
  },
  {
    key: "assignedTo",
    label: "Assigned To",
    render: (item) => item.assignedTo ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}` : "—",
  },
];

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

export default function PlantPage() {
  return <Suspense><PlantContent /></Suspense>;
}

function AssetHoverList({ links, onClickAsset }: { links: LinkedAsset[]; onClickAsset: (id: string) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEnter() {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShow(true);
  }

  function handleLeave() {
    hideTimeout.current = setTimeout(() => setShow(false), 150);
  }

  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-default"
      >
        {links.length} assets
      </button>
      {show && pos && createPortal(
        <div
          onMouseEnter={() => { if (hideTimeout.current) clearTimeout(hideTimeout.current); }}
          onMouseLeave={handleLeave}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border rounded-lg shadow-lg py-1 min-w-[220px]"
        >
          {links.map((link) => (
            <button
              key={link.id}
              onClick={(e) => { e.stopPropagation(); onClickAsset(link.asset.id); setShow(false); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{link.asset.name}</span>
              <span className="text-gray-500 ml-1">({link.asset.assetNumber})</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
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
  const [confirmAction, setConfirmAction] = useState<{ type: "restore" | "delete" } | null>(null);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldSaving, setSoldSaving] = useState(false);
  const [soldError, setSoldError] = useState("");
  const [soldAssetActions, setSoldAssetActions] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteAssetActions, setDeleteAssetActions] = useState<Record<string, string>>({});

  // Asset preview modal state
  const [previewAsset, setPreviewAsset] = useState<{
    id: string; assetNumber: string; name: string; category: string; status: string;
    condition?: string | null; make?: string | null; model?: string | null;
    serialNumber?: string | null; location?: string | null; notes?: string | null;
    purchaseDate?: string | null; purchaseCost?: string | null;
    assignedTo?: { firstName: string; lastName: string } | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Assets queued during plant creation (before the plant exists)
  interface QueuedExistingAsset { type: "existing"; asset: AvailableAsset; notes: string }
  interface QueuedNewAsset { type: "new"; name: string; category: string; make: string; model: string; serialNumber: string; status: string; condition: string; notes: string; linkNotes: string }
  type QueuedAsset = QueuedExistingAsset | QueuedNewAsset;
  const [queuedAssets, setQueuedAssets] = useState<QueuedAsset[]>([]);
  const [showQueueLinkModal, setShowQueueLinkModal] = useState(false);
  const [showQueueCreateModal, setShowQueueCreateModal] = useState(false);
  const [queueLinkSearch, setQueueLinkSearch] = useState("");
  const [queueLinkSelected, setQueueLinkSelected] = useState<AvailableAsset | null>(null);
  const [queueLinkNotes, setQueueLinkNotes] = useState("");

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

  function openAssetPreview(assetId: string) {
    setPreviewLoading(true);
    setPreviewAsset(null);
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setPreviewAsset(data);
        setPreviewLoading(false);
      })
      .catch(() => setPreviewLoading(false));
  }

  // Build columns inside the component so the assets column can call openAssetPreview
  const columns: Column<PlantItem>[] = [
    ...baseColumns,
    {
      key: "assetLinks",
      label: "Linked Assets",
      render: (item) => {
        const links = item.assetLinks || [];
        if (links.length === 0) return <span className="text-gray-400">—</span>;
        if (links.length === 1) {
          const link = links[0];
          return (
            <button
              onClick={(e) => { e.stopPropagation(); openAssetPreview(link.asset.id); }}
              className="text-blue-600 hover:text-blue-800 hover:underline text-left text-sm"
            >
              {link.asset.name} ({link.asset.assetNumber})
            </button>
          );
        }
        return <AssetHoverList links={links} onClickAsset={openAssetPreview} />;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

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
    setQueuedAssets([]);
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
    // Convert empty strings to undefined so optional enum/numeric fields don't fail validation
    const val = (key: string) => { const v = form.get(key); return v === "" || v === null ? undefined : v; };
    return {
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
      // Link any queued assets
      for (const queued of queuedAssets) {
        if (queued.type === "existing") {
          await fetch(`/api/plant/${created.id}/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId: queued.asset.id, notes: queued.notes || undefined }),
          });
        } else {
          await fetch(`/api/plant/${created.id}/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              create: {
                name: queued.name, category: queued.category, make: queued.make, model: queued.model,
                serialNumber: queued.serialNumber, status: queued.status, condition: queued.condition, notes: queued.notes,
              },
              notes: queued.linkNotes || undefined,
            }),
          });
        }
      }
      setQueuedAssets([]);
      setCreating(false);
      setError("");
      loadData(showArchived);
      loadPlantDetail(created.id);
    }
    else {
      const data = await res.json();
      if (data.details && Array.isArray(data.details)) {
        setError(data.details.map((d: { path?: string[]; message?: string }) => `${(d.path || []).join(".")}: ${d.message}`).join(", "));
      } else {
        setError(data.error || "Failed to create.");
      }
    }
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
    else {
      const data = await res.json();
      if (data.details && Array.isArray(data.details)) {
        setError(data.details.map((d: { path?: string[]; message?: string }) => `${(d.path || []).join(".")}: ${d.message}`).join(", "));
      } else {
        setError(data.error || "Failed to update.");
      }
    }
    setSaving(false);
  }

  function openSoldModal() {
    setSoldError("");
    setSoldSaving(false);
    // Initialise asset actions — default all to empty (unresolved)
    const actions: Record<string, string> = {};
    linkedAssets.forEach((link) => { actions[link.asset.id] = ""; });
    setSoldAssetActions(actions);
    setShowSoldModal(true);
  }

  async function handleSold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;

    // Check all linked assets have been resolved
    const unresolved = linkedAssets.filter((link) => !soldAssetActions[link.asset.id]);
    if (unresolved.length > 0) {
      setSoldError("All linked assets must be reassigned or retired before marking as sold.");
      return;
    }

    setSoldSaving(true);
    setSoldError("");

    const form = new FormData(e.currentTarget);

    // 1. Apply asset actions (reassign or retire)
    for (const link of linkedAssets) {
      const action = soldAssetActions[link.asset.id];
      if (action === "RETIRED") {
        // Update asset status to RETIRED
        await fetch(`/api/assets/${link.asset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RETIRED" }),
        });
        // Unlink from this plant
        await fetch(`/api/plant/${selected.id}/assets/${link.id}`, { method: "DELETE" });
      } else if (action.startsWith("REASSIGN:")) {
        // Unlink from current plant, then link to new plant
        const newPlantId = action.replace("REASSIGN:", "");
        await fetch(`/api/plant/${selected.id}/assets/${link.id}`, { method: "DELETE" });
        await fetch(`/api/plant/${newPlantId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: link.asset.id, notes: link.notes || undefined }),
        });
      }
    }

    // 2. Update plant with sold info
    await fetch(`/api/plant/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soldDate: form.get("soldDate"),
        soldPrice: form.get("soldPrice"),
        comments: form.get("soldComments"),
      }),
    });

    // 3. Archive (soft-delete) the plant
    const res = await fetch(`/api/plant/${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      setShowSoldModal(false);
      closeModal();
      loadData(showArchived);
    } else {
      const data = await res.json();
      setSoldError(data.error || "Failed to mark as sold.");
    }
    setSoldSaving(false);
  }

  async function handleRestore() {
    if (!selected) return;
    const res = await fetch(`/api/plant/${selected.id}/restore`, { method: "POST" });
    if (res.ok) { setConfirmAction(null); closeModal(); loadData(showArchived); }
  }

  function openDeleteModal() {
    setDeleteError("");
    setDeleteSaving(false);
    const actions: Record<string, string> = {};
    linkedAssets.forEach((link) => { actions[link.asset.id] = ""; });
    setDeleteAssetActions(actions);
    setShowDeleteModal(true);
  }

  async function handlePermanentDelete() {
    if (!selected) return;

    // Check all linked assets have been resolved
    const unresolved = linkedAssets.filter((link) => !deleteAssetActions[link.asset.id]);
    if (unresolved.length > 0) {
      setDeleteError("All linked assets must be reassigned or retired before deleting.");
      return;
    }

    setDeleteSaving(true);
    setDeleteError("");

    // 1. Apply asset actions (reassign or retire)
    for (const link of linkedAssets) {
      const action = deleteAssetActions[link.asset.id];
      if (action === "RETIRED") {
        await fetch(`/api/assets/${link.asset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RETIRED" }),
        });
        await fetch(`/api/plant/${selected.id}/assets/${link.id}`, { method: "DELETE" });
      } else if (action.startsWith("REASSIGN:")) {
        const newPlantId = action.replace("REASSIGN:", "");
        await fetch(`/api/plant/${selected.id}/assets/${link.id}`, { method: "DELETE" });
        await fetch(`/api/plant/${newPlantId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: link.asset.id, notes: link.notes || undefined }),
        });
      }
    }

    // 2. Permanently delete the plant
    const res = await fetch(`/api/plant/${selected.id}/purge`, { method: "POST" });
    if (res.ok) {
      setShowDeleteModal(false);
      setConfirmAction(null);
      closeModal();
      loadData(showArchived);
    } else {
      const data = await res.json();
      setDeleteError(data.error || "Failed to delete.");
    }
    setDeleteSaving(false);
  }

  function PlantForm({ defaults, onSubmit, submitLabel, onSold, onDelete }: { defaults?: PlantItem; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; submitLabel: string; onSold?: () => void; onDelete?: () => void }) {
    return (
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {defaults?.plantNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plant Number</label>
              <p className="text-sm font-medium text-gray-900 py-2">{defaults.plantNumber}</p>
            </div>
          )}
          <SelectField label="Category" name="category" required defaultValue={defaults?.category || ""} options={PLANT_CATEGORY_OPTIONS} />
          <SelectField label="Status" name="status" required defaultValue={defaults?.status || "OPERATIONAL"} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField label="State Registered" name="stateRegistered" defaultValue={defaults?.stateRegistered || ""} options={STATE_OPTIONS} />
          <FormField label="Registration Number" name="registrationNumber" placeholder="e.g. ABC-123" defaultValue={defaults?.registrationNumber || ""} />
          <FormField label="VIN Number" name="vinNumber" defaultValue={defaults?.vinNumber || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Year" name="year" type="number" placeholder="e.g. 2020" defaultValue={defaults?.year?.toString() || ""} />
          <FormField label="Make" name="make" placeholder="e.g. Caterpillar" defaultValue={defaults?.make || ""} />
          <FormField label="Model" name="model" placeholder="e.g. 320" defaultValue={defaults?.model || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField label="Licence Type Required" name="licenceType" defaultValue={defaults?.licenceType || ""} options={LICENCE_TYPE_OPTIONS} />
          <SelectField label="Location" name="location" defaultValue={defaults?.location || ""} options={LOCATION_OPTIONS} />
          <SelectField label="Assigned To" name="assignedToId" defaultValue={defaults?.assignedToId || ""} options={employeeOptions} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField label="Condition" name="condition" defaultValue={defaults?.condition || ""} options={CONDITION_OPTIONS} />
          <FormField label="Ampol Card Number" name="ampolCardNumber" defaultValue={defaults?.ampolCardNumber || ""} />
          <FormField label="Ampol Card Expiry" name="ampolCardExpiry" type="date" defaultValue={formatDate(defaults?.ampolCardExpiry || null)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Linkt Tag Number" name="linktTagNumber" defaultValue={defaults?.linktTagNumber || ""} />
          <FormField label="Fleet Dynamics Serial Number" name="fleetDynamicsSerialNumber" defaultValue={defaults?.fleetDynamicsSerialNumber || ""} />
          <FormField label="COI Expiration Date" name="coiExpirationDate" type="date" defaultValue={formatDate(defaults?.coiExpirationDate || null)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Purchase Date" name="purchaseDate" type="date" defaultValue={formatDate(defaults?.purchaseDate || null)} />
          <FormField label="Purchase Price" name="purchasePrice" type="number" placeholder="0.00" defaultValue={defaults?.purchasePrice?.toString() || ""} />
          <FormField label="Last Service Date" name="lastServiceDate" type="date" defaultValue={formatDate(defaults?.lastServiceDate || null)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Next Service Due" name="nextServiceDue" type="date" defaultValue={formatDate(defaults?.nextServiceDue || null)} />
        </div>
        <TextAreaField label="Comments" name="comments" defaultValue={defaults?.comments || ""} placeholder="Optional comments..." />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? "Saving..." : submitLabel}</button>
          <button type="button" onClick={closeModal} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          {(onSold || onDelete) && <div className="flex-1" />}
          {onSold && <button type="button" onClick={onSold} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">Sold</button>}
          {onDelete && <button type="button" onClick={onDelete} className="border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">Delete</button>}
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
            Sold
          </button>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://tracking.fleetdynamics.com.au/" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Fleet Dynamics</a>
          {!showArchived && (
            <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Add Plant</button>
          )}
        </div>
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <DataTable columns={columns} data={plant} onRowClick={(p) => { loadPlantDetail(p.id); setEditing(false); }} emptyMessage={showArchived ? "No sold plant items." : "No plant items found. Click '+ Add Plant' to create one."} />
      )}

      {/* Detail / Edit Modal */}
      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{selected.plantNumber}</h2>
              <StatusBadge status={selected.status} />
              {selected.condition && <StatusBadge status={selected.condition} />}
              {selected.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Sold</span>
              )}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Plant #</dt><dd className="font-medium text-gray-900">{selected.plantNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Category</dt><dd className="font-medium text-gray-900">{PLANT_CATEGORY_LABELS[selected.category] || selected.category}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">State Registered</dt><dd className="font-medium text-gray-900">{selected.stateRegistered || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Rego</dt><dd className="font-medium text-gray-900">{selected.registrationNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">VIN Number</dt><dd className="font-medium text-gray-900">{selected.vinNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Year</dt><dd className="font-medium text-gray-900">{selected.year || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Make</dt><dd className="font-medium text-gray-900">{selected.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Model</dt><dd className="font-medium text-gray-900">{selected.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Licence Type</dt><dd className="font-medium text-gray-900">{selected.licenceType || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Location</dt><dd className="font-medium text-gray-900">{selected.location ? (LOCATION_LABELS[selected.location] || selected.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Assigned To</dt><dd className="font-medium text-gray-900">{selected.assignedTo ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Condition</dt><dd className="font-medium text-gray-900">{selected.condition || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Ampol Card #</dt><dd className="font-medium text-gray-900">{selected.ampolCardNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Ampol Card Expiry</dt><dd className="font-medium text-gray-900">{formatDate(selected.ampolCardExpiry) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Linkt Tag #</dt><dd className="font-medium text-gray-900">{selected.linktTagNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Fleet Dynamics Serial</dt><dd className="font-medium text-gray-900">{selected.fleetDynamicsSerialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">COI Expiration</dt><dd className="font-medium text-gray-900">{formatDate(selected.coiExpirationDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.purchaseDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Price</dt><dd className="font-medium text-gray-900">{selected.purchasePrice ? `$${selected.purchasePrice}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Sold Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.soldDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Sold Price</dt><dd className="font-medium text-gray-900">{selected.soldPrice ? `$${selected.soldPrice}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Last Service</dt><dd className="font-medium text-gray-900">{formatDate(selected.lastServiceDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Next Service</dt><dd className="font-medium text-gray-900">{formatDate(selected.nextServiceDue) || "—"}</dd></div>
            </dl>
            {selected.comments && (
              <div className="mt-3 text-sm"><p className="text-gray-400 text-xs uppercase tracking-wider">Comments</p><p className="text-gray-900 whitespace-pre-wrap">{selected.comments}</p></div>
            )}

            {/* Linked Assets Section */}
            <div className="mt-4 pt-4 border-t">
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

            <div className="flex gap-3 mt-4 pt-4 border-t">
              {selected.isArchived ? (
                <button onClick={() => setConfirmAction({ type: "restore" })} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Restore to Active</button>
              ) : (
                <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Edit</button>
              )}
            </div>
          </div>
        )}
        {selected && editing && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Edit Plant</h2>
            <PlantForm defaults={selected} onSubmit={handleUpdate} submitLabel="Save Changes" onSold={openSoldModal} onDelete={openDeleteModal} />
          </div>
        )}
      </Modal>

      {/* Create Plant Modal — stays mounted when sub-modals open so form data is preserved */}
      <Modal isOpen={creating} onClose={() => { closeModal(); setQueuedAssets([]); }}>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Add Plant</h2>
        <PlantForm onSubmit={handleCreate} submitLabel="Create Plant Item" />

        {/* Queued assets section */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Linked Assets</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                setShowQueueLinkModal(true);
                setQueueLinkSearch("");
                setQueueLinkSelected(null);
                setQueueLinkNotes("");
                fetch("/api/assets").then((r) => r.json()).then((data) => {
                  const queuedIds = new Set(queuedAssets.filter((q) => q.type === "existing").map((q) => (q as QueuedExistingAsset).asset.id));
                  setAvailableAssets((data as AvailableAsset[]).filter((a) => !queuedIds.has(a.id)));
                });
              }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                + Link Existing
              </button>
              <button type="button" onClick={() => { setShowQueueCreateModal(true); setLinkError(""); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                + Create New
              </button>
            </div>
          </div>
          {queuedAssets.length === 0 ? (
            <p className="text-sm text-gray-400">No assets linked yet. You can add them now or after creation.</p>
          ) : (
            <div className="space-y-2">
              {queuedAssets.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded border text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{q.type === "existing" ? q.asset.name : q.name}</span>
                    {q.type === "existing" && <span className="text-gray-500 ml-2">({q.asset.assetNumber})</span>}
                    {q.type === "new" && <span className="text-gray-400 ml-2">(new)</span>}
                    <span className="text-gray-400 ml-2">{q.type === "existing" ? q.asset.category : q.category}</span>
                  </div>
                  <button type="button" onClick={() => setQueuedAssets(queuedAssets.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Queue: Link Existing Asset (during create) */}
      <Modal isOpen={showQueueLinkModal} onClose={() => setShowQueueLinkModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Link Existing Asset</h2>
        <input
          type="text"
          placeholder="Search by name, number, or category..."
          value={queueLinkSearch}
          onChange={(e) => setQueueLinkSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="max-h-48 overflow-y-auto border rounded mb-3">
          {availableAssets.filter((a) => {
            if (!queueLinkSearch) return true;
            const q = queueLinkSearch.toLowerCase();
            return a.name.toLowerCase().includes(q) || a.assetNumber.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
          }).length === 0 ? (
            <p className="text-sm text-gray-400 p-3">No available assets found.</p>
          ) : (
            availableAssets.filter((a) => {
              if (!queueLinkSearch) return true;
              const q = queueLinkSearch.toLowerCase();
              return a.name.toLowerCase().includes(q) || a.assetNumber.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
            }).map((a) => (
              <button key={a.id} type="button" onClick={() => setQueueLinkSelected(a)}
                className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-blue-50 transition-colors ${queueLinkSelected?.id === a.id ? "bg-blue-50 border-blue-200" : ""}`}>
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className="text-gray-500 ml-2">({a.assetNumber})</span>
                <span className="text-gray-400 ml-2">{a.category}</span>
              </button>
            ))
          )}
        </div>
        <TextAreaField label="Link Notes (optional)" name="queueLinkNotes" value={queueLinkNotes} onChange={(e) => setQueueLinkNotes(e.target.value)} placeholder="e.g. Mounted behind driver seat" />
        <div className="flex gap-3 pt-3">
          <button type="button" disabled={!queueLinkSelected} onClick={() => {
            if (queueLinkSelected) {
              setQueuedAssets([...queuedAssets, { type: "existing", asset: queueLinkSelected, notes: queueLinkNotes }]);
              setShowQueueLinkModal(false);
            }
          }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">Add Asset</button>
          <button type="button" onClick={() => setShowQueueLinkModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </Modal>

      {/* Queue: Create New Asset (during create) */}
      <Modal isOpen={showQueueCreateModal} onClose={() => setShowQueueCreateModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Asset</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setQueuedAssets([...queuedAssets, {
            type: "new",
            name: form.get("name") as string,
            category: form.get("category") as string,
            make: form.get("make") as string,
            model: form.get("model") as string,
            serialNumber: form.get("serialNumber") as string,
            status: form.get("status") as string,
            condition: form.get("condition") as string,
            notes: form.get("assetNotes") as string,
            linkNotes: form.get("linkNotes") as string,
          }]);
          setShowQueueCreateModal(false);
        }} className="space-y-4">
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
          <div className="flex gap-3 pt-3">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Add Asset</button>
            <button type="button" onClick={() => setShowQueueCreateModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Link Existing Asset Modal */}
      <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Link Existing Asset</h2>
        <p className="text-sm text-gray-500 mb-4">
          Search for an asset to link to <strong>{selected?.plantNumber}</strong>.
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
          Create a new asset and automatically link it to <strong>{selected?.plantNumber}</strong>.
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

      {/* Restore Confirmation */}
      <ConfirmDialog
        isOpen={confirmAction?.type === "restore"}
        title="Restore Plant"
        message="Are you sure you want to restore this plant item? It will be moved back to the active list."
        confirmLabel="Restore"
        confirmVariant="success"
        onConfirm={handleRestore}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Permanent Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Permanently Delete Plant</h2>
        <p className="text-sm text-gray-500 mb-4">
          This action cannot be undone — all data for <strong>{selected?.plantNumber}</strong> will be permanently erased.
        </p>
        {linkedAssets.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 mb-2">
              This plant has {linkedAssets.length} linked asset{linkedAssets.length !== 1 ? "s" : ""} that must be dealt with before it can be deleted:
            </p>
            <div className="space-y-2">
              {linkedAssets.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded border text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{link.asset.name}</span>
                    <span className="text-gray-500 ml-1">({link.asset.assetNumber})</span>
                  </div>
                  <select
                    value={deleteAssetActions[link.asset.id] || ""}
                    onChange={(e) => setDeleteAssetActions({ ...deleteAssetActions, [link.asset.id]: e.target.value })}
                    className="text-sm border border-gray-300 rounded px-2 py-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select action --</option>
                    <option value="RETIRED">Retire asset</option>
                    {plant.filter((p) => p.id !== selected?.id && !p.isArchived).map((p) => (
                      <option key={p.id} value={`REASSIGN:${p.id}`}>Reassign to {p.plantNumber}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handlePermanentDelete}
            disabled={deleteSaving}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleteSaving ? "Deleting..." : "Delete Permanently"}
          </button>
          <button type="button" onClick={() => setShowDeleteModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </Modal>

      {/* Sold Modal */}
      <Modal isOpen={showSoldModal} onClose={() => setShowSoldModal(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Mark as Sold</h2>
        <p className="text-sm text-gray-500 mb-4">Record sale details for <strong>{selected?.plantNumber}</strong>.</p>

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
                    {plant.filter((p) => p.id !== selected?.id && !p.isArchived).map((p) => (
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
          <TextAreaField label="Comments" name="soldComments" defaultValue={selected?.comments || ""} placeholder="Optional comments about the sale..." />
          {soldError && <p className="text-red-500 text-sm">{soldError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={soldSaving} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
              {soldSaving ? "Processing..." : "Confirm Sale"}
            </button>
            <button type="button" onClick={() => setShowSoldModal(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Asset Preview Modal */}
      <Modal isOpen={!!previewAsset || previewLoading} onClose={() => { setPreviewAsset(null); setPreviewLoading(false); }}>
        {previewLoading && <p className="text-sm text-gray-500">Loading asset...</p>}
        {previewAsset && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{previewAsset.name}</h2>
              <StatusBadge status={previewAsset.status} />
              {previewAsset.condition && <StatusBadge status={previewAsset.condition} />}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Asset #</dt><dd className="font-medium text-gray-900">{previewAsset.assetNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Category</dt><dd className="font-medium text-gray-900">{previewAsset.category}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Make</dt><dd className="font-medium text-gray-900">{previewAsset.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Model</dt><dd className="font-medium text-gray-900">{previewAsset.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Serial #</dt><dd className="font-medium text-gray-900">{previewAsset.serialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Condition</dt><dd className="font-medium text-gray-900">{previewAsset.condition || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Location</dt><dd className="font-medium text-gray-900">{previewAsset.location ? (LOCATION_LABELS[previewAsset.location] || previewAsset.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(previewAsset.purchaseDate || null) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Cost</dt><dd className="font-medium text-gray-900">{previewAsset.purchaseCost ? `$${previewAsset.purchaseCost}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Assigned To</dt><dd className="font-medium text-gray-900">{previewAsset.assignedTo ? `${previewAsset.assignedTo.firstName} ${previewAsset.assignedTo.lastName}` : "—"}</dd></div>
            </dl>
            {previewAsset.notes && (
              <div className="mt-3 text-sm">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Notes</p>
                <p className="text-gray-900 whitespace-pre-wrap">{previewAsset.notes}</p>
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button onClick={() => setPreviewAsset(null)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
