"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/shared/components/PageHeader";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  entityLabel: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  performedBy: { id: string; name: string; email: string };
  performedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  ARCHIVE: "bg-red-100 text-red-700",
  RESTORE: "bg-amber-100 text-amber-700",
};

const ENTITY_COLORS: Record<string, string> = {
  Employee: "bg-purple-100 text-purple-700",
  Asset: "bg-cyan-100 text-cyan-700",
  Plant: "bg-orange-100 text-orange-700",
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  roleType: "Role Type",
  employmentType: "Employment Type",
  location: "Location",
  startDate: "Start Date",
  endDate: "End Date",
  probationDate: "Probation Review",
  status: "Status",
  notes: "Notes",
  assetNumber: "Asset #",
  plantNumber: "Plant #",
  name: "Name",
  category: "Category",
  make: "Make",
  model: "Model",
  serialNumber: "Serial Number",
  purchaseDate: "Purchase Date",
  purchaseCost: "Purchase Cost",
  condition: "Condition",
  assignedToId: "Assigned To",
  yearOfManufacture: "Year",
  registrationNumber: "Registration",
  lastServiceDate: "Last Service",
  nextServiceDue: "Next Service Due",
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    return new Date(val).toLocaleDateString("en-AU");
  }
  return String(val);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AU");
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);

  const load = useCallback((page: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);

    fetch(`/api/activity-log?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs);
        setPagination(data.pagination);
        // Default: expand all entries that have changes
        const expandable = (data.logs as AuditEntry[])
          .filter((l) => l.changes)
          .map((l) => l.id);
        setExpanded(new Set(expandable));
        setAllExpanded(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [entityType, action]);

  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
      setAllExpanded(false);
    } else {
      const expandable = logs.filter((l) => l.changes).map((l) => l.id);
      setExpanded(new Set(expandable));
      setAllExpanded(true);
    }
  };

  const toggleOne = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => { load(1); }, [load]);

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Track all changes across employees, assets, and plant."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Types</option>
          <option value="Employee">Employees</option>
          <option value="Asset">Assets</option>
          <option value="Plant">Plant</option>
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="ARCHIVE">Archived</option>
          <option value="RESTORE">Restored</option>
        </select>
        <button
          onClick={toggleAll}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          {allExpanded ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              Collapse All
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              Expand All
            </>
          )}
        </button>
        {(entityType || action) && (
          <button
            onClick={() => { setEntityType(""); setAction(""); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No activity recorded yet. Changes will appear here as they happen.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white border rounded-lg">
              <button
                onClick={() => toggleOne(log.id)}
                className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                  {log.action}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENTITY_COLORS[log.entityType] || "bg-gray-100 text-gray-600"}`}>
                  {log.entityType}
                </span>
                <span className="text-sm font-medium text-gray-900">{log.entityLabel}</span>
                <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                  {log.performedBy.name} &middot; {timeAgo(log.performedAt)}
                </span>
                {log.changes && (
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(log.id) ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {expanded.has(log.id) && log.changes && (
                <div className="px-4 pb-3 border-t">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase tracking-wider">
                        <th className="text-left py-1 font-medium">Field</th>
                        <th className="text-left py-1 font-medium">From</th>
                        <th className="text-left py-1 font-medium">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(log.changes).map(([field, { from, to }]) => (
                        <tr key={field} className="border-t border-gray-100">
                          <td className="py-1.5 text-gray-600 font-medium">{FIELD_LABELS[field] || field}</td>
                          <td className="py-1.5 text-red-600">{formatValue(from)}</td>
                          <td className="py-1.5 text-green-600">{formatValue(to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <button
            onClick={() => load(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => load(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
