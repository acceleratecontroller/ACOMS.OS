"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { FormField, SelectField, TextAreaField } from "@/shared/components/FormField";
import TagComboBox from "@/shared/components/TagComboBox";
import { filterByRegion } from "@/shared/components/RegionToggle";
import { useRegionFilter } from "@/shared/context/RegionFilter";
import type { Location } from "@prisma/client";
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
  plant: { id: string; plantNumber: string };
}

interface Asset {
  id: string;
  assetNumber: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: string | null;
  location: Location | null;
  status: string;
  condition: string | null;
  notes: string | null;
  isArchived: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
  externallyOwned: boolean;
  externalOwnerId: string | null;
  externalOwner: { id: string; name: string } | null;
  plantLinks?: PlantLink[];
  expires: boolean;
  expirationDate: string | null;
}

const STATIC_COLUMNS: Column<Asset>[] = [
  { key: "assetNumber", label: "Asset #" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category", render: (item) => item.category?.name ?? "—" },
  { key: "location", label: "Location" },
];

const TAIL_COLUMNS: Column<Asset>[] = [
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
  const [expirationFilter, setExpirationFilter] = useState<"all" | "expired" | "expiring_soon">("all");
  const { selectedRegions } = useRegionFilter();
  const [confirmAction, setConfirmAction] = useState<{ type: "archive" | "restore" } | null>(null);
  // Plant preview modal state
  const [previewPlant, setPreviewPlant] = useState<{
    plantNumber: string; category: string; status: string; condition?: string | null;
    make?: string | null; model?: string | null; year?: number | null;
    registrationNumber?: string | null; vinNumber?: string | null;
    stateRegistered?: string | null; licenceType?: string | null;
    location?: string | null; comments?: string | null;
    purchaseDate?: string | null; purchasePrice?: string | null;
    lastServiceDate?: string | null; nextServiceDue?: string | null;
    assignedTo?: { firstName: string; lastName: string } | null;
  } | null>(null);
  const [previewPlantLoading, setPreviewPlantLoading] = useState(false);
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

  // Expiration helpers
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  function getExpirationFlag(asset: Asset): "expired" | "expiring_soon" | null {
    if (!asset.expires || !asset.expirationDate) return null;
    if (asset.expirationDate < now || asset.status === "EXPIRED") return "expired";
    if (asset.expirationDate < thirtyDaysFromNow) return "expiring_soon";
    return null;
  }

  const expiredCount = assets.filter((a) => getExpirationFlag(a) === "expired").length;
  const expiringSoonCount = assets.filter((a) => getExpirationFlag(a) === "expiring_soon").length;

  const filteredAssets = filterByRegion(
    expirationFilter === "all"
      ? assets
      : assets.filter((a) => getExpirationFlag(a) === (expirationFilter === "expired" ? "expired" : "expiring_soon")),
    selectedRegions,
  );

  // Load full asset detail (includes plantLinks)
  function loadAssetDetail(assetId: string) {
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSelected(data); });
  }

  function openPlantPreview(plantId: string) {
    setPreviewPlantLoading(true);
    setPreviewPlant(null);
    fetch(`/api/plant/${plantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setPreviewPlant(data);
        setPreviewPlantLoading(false);
      })
      .catch(() => setPreviewPlantLoading(false));
  }

  const columns: Column<Asset>[] = [
    ...STATIC_COLUMNS,
    {
      key: "plantLinks",
      label: "Linked Plant",
      render: (item) => {
        const links = item.plantLinks || [];
        if (links.length === 0) return <span className="text-gray-400">—</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={(e) => { e.stopPropagation(); openPlantPreview(l.plant.id); }}
                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                {l.plant.plantNumber}
              </button>
            ))}
          </span>
        );
      },
    },
    ...TAIL_COLUMNS,
    {
      key: "expires" as keyof Asset,
      label: "Expiry",
      render: (item) => {
        const flag = getExpirationFlag(item);
        if (flag === "expired") return <StatusBadge status="EXPIRED" />;
        if (flag === "expiring_soon") return <StatusBadge status="EXPIRING_SOON" />;
        if (item.expires && item.expirationDate) return <span className="text-xs text-gray-500">{formatDate(item.expirationDate)}</span>;
        return <span className="text-gray-400">—</span>;
      },
    },
  ];

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setError("");
  }

  function getFormBody(form: FormData) {
    const externallyOwned = form.get("externallyOwned") === "true";
    return {
      name: form.get("name"),
      categoryId: form.get("categoryId"),
      make: form.get("make"),
      model: form.get("model"),
      serialNumber: form.get("serialNumber"),
      purchaseDate: form.get("purchaseDate"),
      purchaseCost: form.get("purchaseCost"),
      location: form.get("location"),
      assignedToId: form.get("assignedToId"),
      externallyOwned,
      externalOwnerId: externallyOwned ? form.get("externalOwnerId") : null,
      status: form.get("status"),
      condition: form.get("condition"),
      notes: form.get("notes"),
      expires: form.get("expires") === "on",
      expirationDate: form.get("expirationDate") || "",
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
    const [expiresChecked, setExpiresChecked] = useState(defaults?.expires ?? false);
    const [categoryId, setCategoryId] = useState(defaults?.categoryId || "");
    const [externallyOwned, setExternallyOwned] = useState(defaults?.externallyOwned ?? false);
    const [externalOwnerId, setExternalOwnerId] = useState(defaults?.externalOwnerId || "");
    const defaultExpDate = defaults?.expirationDate
      ? formatDate(defaults.expirationDate)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isLinkedToPlant = (defaults?.plantLinks?.length ?? 0) > 0;
    const linkedPlantHint = isLinkedToPlant ? "Managed by linked plant" : undefined;

    function handleSubmitWrapper(e: React.FormEvent<HTMLFormElement>) {
      if (!categoryId) {
        e.preventDefault();
        setError("Category is required");
        return;
      }
      if (externallyOwned && !externalOwnerId) {
        e.preventDefault();
        setError("External owner is required when 'Owned by external party' is ticked");
        return;
      }
      onSubmit(e);
    }

    return (
      <form onSubmit={handleSubmitWrapper} className="space-y-3">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="externallyOwned" value={externallyOwned ? "true" : "false"} />
        <input type="hidden" name="externalOwnerId" value={externallyOwned ? externalOwnerId : ""} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {defaults?.assetNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Number</label>
              <p className="text-sm font-medium text-gray-900 py-2">{defaults.assetNumber}</p>
            </div>
          )}
          <FormField label="Name" name="name" required placeholder="e.g. Makita Impact Drill" defaultValue={defaults?.name || ""} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <TagComboBox
              value={categoryId}
              onChange={(id) => setCategoryId(id)}
              endpoint="/api/assets/categories"
              placeholder="Search or create..."
              initialLabel={defaults?.category?.name || null}
              required
            />
          </div>
          <SelectField label="Status" name="status" required defaultValue={defaults?.status || "AVAILABLE"} options={STATUS_OPTIONS} />
        </div>
        {/* External ownership toggle */}
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={externallyOwned}
              onChange={(e) => {
                setExternallyOwned(e.target.checked);
                if (!e.target.checked) setExternalOwnerId("");
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Owned by external party</span>
            <span className="text-xs text-gray-500">— typically another company</span>
          </label>
          {externallyOwned && (
            <div className="mt-2 ml-6 max-w-md">
              <label className="block text-xs text-gray-500 mb-1">Owner <span className="text-red-500">*</span></label>
              <TagComboBox
                value={externalOwnerId}
                onChange={(id) => setExternalOwnerId(id)}
                endpoint="/api/assets/owners"
                placeholder="Search or create company..."
                emptyHint="No owners yet — type a company name to create one"
                initialLabel={defaults?.externalOwner?.name || null}
                required
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Make" name="make" placeholder="e.g. Makita" defaultValue={defaults?.make || ""} />
          <FormField label="Model" name="model" placeholder="e.g. DTD172" defaultValue={defaults?.model || ""} />
          <FormField label="Serial Number" name="serialNumber" defaultValue={defaults?.serialNumber || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField label="Condition" name="condition" defaultValue={defaults?.condition || ""} options={CONDITION_OPTIONS} />
          <FormField label="Purchase Date" name="purchaseDate" type="date" defaultValue={formatDate(defaults?.purchaseDate || null)} />
          <FormField label="Purchase Cost" name="purchaseCost" type="number" placeholder="0.00" defaultValue={defaults?.purchaseCost?.toString() || ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField label="Location" name="location" defaultValue={defaults?.location || ""} options={LOCATION_OPTIONS} disabled={isLinkedToPlant} hint={linkedPlantHint} />
          <SelectField label="Assigned To" name="assignedToId" defaultValue={defaults?.assignedToId || ""} options={employeeOptions} disabled={isLinkedToPlant} hint={linkedPlantHint} />
        </div>
        <TextAreaField label="Notes" name="notes" defaultValue={defaults?.notes || ""} placeholder="Optional notes..." />
        {/* Expiration toggle */}
        <div className="border border-gray-200 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="expires"
              checked={expiresChecked}
              onChange={(e) => setExpiresChecked(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">This asset expires</span>
          </label>
          {expiresChecked && (
            <div className="mt-2 ml-6">
              <FormField label="Expiration Date" name="expirationDate" type="date" defaultValue={defaultExpDate} />
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
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
            onClick={() => { setShowArchived(false); setExpirationFilter("all"); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showArchived && expirationFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          {!showArchived && expiredCount > 0 && (
            <button
              onClick={() => setExpirationFilter(expirationFilter === "expired" ? "all" : "expired")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                expirationFilter === "expired" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              Expired ({expiredCount})
            </button>
          )}
          {!showArchived && expiringSoonCount > 0 && (
            <button
              onClick={() => setExpirationFilter(expirationFilter === "expiring_soon" ? "all" : "expiring_soon")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                expirationFilter === "expiring_soon" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              Expiring Soon ({expiringSoonCount})
            </button>
          )}
        </div>
        {!showArchived && (
          <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Add Asset</button>
        )}
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <DataTable columns={columns} data={filteredAssets} onRowClick={(a) => { loadAssetDetail(a.id); setEditing(false); }} emptyMessage={showArchived ? "No archived assets." : "No assets found. Click '+ Add Asset' to create one."} />
      )}

      <Modal isOpen={!!selected && !creating} onClose={closeModal}>
        {selected && !editing && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
              <StatusBadge status={selected.status} />
              {selected.condition && <StatusBadge status={selected.condition} />}
              {selected.isArchived && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Archived</span>
              )}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Asset #</dt><dd className="font-medium text-gray-900">{selected.assetNumber}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Category</dt><dd className="font-medium text-gray-900">{selected.category?.name || "—"}</dd></div>
              {selected.externallyOwned && (
                <div>
                  <dt className="text-gray-400 text-xs uppercase tracking-wider">Owned by</dt>
                  <dd className="font-medium text-gray-900 flex items-center gap-1.5">
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px] font-medium">External</span>
                    {selected.externalOwner?.name || "—"}
                  </dd>
                </div>
              )}
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Make</dt><dd className="font-medium text-gray-900">{selected.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Model</dt><dd className="font-medium text-gray-900">{selected.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Serial #</dt><dd className="font-medium text-gray-900">{selected.serialNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Condition</dt><dd className="font-medium text-gray-900">{selected.condition || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Location</dt><dd className="font-medium text-gray-900">{selected.location ? (LOCATION_LABELS[selected.location] || selected.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(selected.purchaseDate) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Cost</dt><dd className="font-medium text-gray-900">{selected.purchaseCost ? `$${selected.purchaseCost}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Assigned To</dt><dd className="font-medium text-gray-900">{selected.assignedTo ? `${selected.assignedTo.firstName} ${selected.assignedTo.lastName}` : "—"}</dd></div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wider">Expires</dt>
                <dd className="font-medium text-gray-900">
                  {selected.expires ? (
                    <span className="flex items-center gap-2">
                      {formatDate(selected.expirationDate) || "—"}
                      {(() => {
                        const flag = getExpirationFlag(selected);
                        if (flag === "expired") return <StatusBadge status="EXPIRED" />;
                        if (flag === "expiring_soon") return <StatusBadge status="EXPIRING_SOON" />;
                        return null;
                      })()}
                    </span>
                  ) : "No"}
                </dd>
              </div>
            </dl>
            {selected.notes && (
              <div className="mt-3 text-sm"><p className="text-gray-400 text-xs uppercase tracking-wider">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>
            )}
            {/* Linked Plant Info */}
            {selected.plantLinks && selected.plantLinks.length > 0 && (
              <div className="mt-5 pt-4 border-t">
                <h3 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Linked to Plant</h3>
                <div className="space-y-1">
                  {selected.plantLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-2 text-sm">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                      <button
                        onClick={() => openPlantPreview(link.plant.id)}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.plant.plantNumber}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t">
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">Edit Asset</h2>
            <AssetForm defaults={selected} onSubmit={handleUpdate} submitLabel="Save Changes" onArchive={() => setConfirmAction({ type: "archive" })} />
          </div>
        )}
      </Modal>

      <Modal isOpen={creating} onClose={closeModal}>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Add Asset</h2>
        <AssetForm onSubmit={handleCreate} submitLabel="Create Asset" />
      </Modal>

      {/* Plant Preview Modal */}
      <Modal isOpen={!!previewPlant || previewPlantLoading} onClose={() => { setPreviewPlant(null); setPreviewPlantLoading(false); }}>
        {previewPlantLoading && <p className="text-sm text-gray-500">Loading plant...</p>}
        {previewPlant && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-gray-900">{previewPlant.plantNumber}</h2>
              <StatusBadge status={previewPlant.status} />
              {previewPlant.condition && <StatusBadge status={previewPlant.condition} />}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Category</dt><dd className="font-medium text-gray-900">{previewPlant.category?.replace(/_/g, " ") || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Make</dt><dd className="font-medium text-gray-900">{previewPlant.make || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Model</dt><dd className="font-medium text-gray-900">{previewPlant.model || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Year</dt><dd className="font-medium text-gray-900">{previewPlant.year || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Registration</dt><dd className="font-medium text-gray-900">{previewPlant.registrationNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">VIN</dt><dd className="font-medium text-gray-900">{previewPlant.vinNumber || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">State</dt><dd className="font-medium text-gray-900">{previewPlant.stateRegistered || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Licence Type</dt><dd className="font-medium text-gray-900">{previewPlant.licenceType || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Location</dt><dd className="font-medium text-gray-900">{previewPlant.location ? (LOCATION_LABELS[previewPlant.location] || previewPlant.location) : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Date</dt><dd className="font-medium text-gray-900">{formatDate(previewPlant.purchaseDate || null) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Purchase Price</dt><dd className="font-medium text-gray-900">{previewPlant.purchasePrice ? `$${previewPlant.purchasePrice}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Assigned To</dt><dd className="font-medium text-gray-900">{previewPlant.assignedTo ? `${previewPlant.assignedTo.firstName} ${previewPlant.assignedTo.lastName}` : "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Last Service</dt><dd className="font-medium text-gray-900">{formatDate(previewPlant.lastServiceDate || null) || "—"}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase tracking-wider">Next Service Due</dt><dd className="font-medium text-gray-900">{formatDate(previewPlant.nextServiceDue || null) || "—"}</dd></div>
            </dl>
            {previewPlant.comments && (
              <div className="mt-3 text-sm">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Comments</p>
                <p className="text-gray-900 whitespace-pre-wrap">{previewPlant.comments}</p>
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button onClick={() => setPreviewPlant(null)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        )}
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
