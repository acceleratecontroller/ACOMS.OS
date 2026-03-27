"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/shared/components/PageHeader";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  entityLabel: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  performedById: string;
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
  vinNumber: "VIN Number",
  purchaseDate: "Purchase Date",
  purchaseCost: "Purchase Cost",
  purchasePrice: "Purchase Price",
  condition: "Condition",
  assignedToId: "Assigned To",
  yearOfManufacture: "Year",
  year: "Year",
  registrationNumber: "Registration",
  stateRegistered: "State Registered",
  licenceType: "Licence Type",
  ampolCardNumber: "Ampol Card #",
  ampolCardExpiry: "Ampol Card Expiry",
  linktTagNumber: "Linkt Tag #",
  fleetDynamicsSerialNumber: "Fleet Dynamics Serial",
  coiExpirationDate: "COI Expiration",
  soldDate: "Sold Date",
  soldPrice: "Sold Price",
  comments: "Comments",
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
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ label: string; type: string }[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [sugHighlight, setSugHighlight] = useState(-1);
  const sugWrapperRef = useRef<HTMLDivElement>(null);
  const sugDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const load = useCallback((page: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    if (keyword) params.set("keyword", keyword);

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
  }, [entityType, action, keyword]);

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

  function fetchSuggestions(term: string) {
    if (term.length < 2) { setSuggestions([]); return; }
    fetch(`/api/activity-log/suggestions?q=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((data) => { setSuggestions(data); setSugHighlight(-1); })
      .catch(() => {});
  }

  function handleKeywordInput(value: string) {
    setKeywordInput(value);
    setSuggestionsOpen(true);
    if (sugDebounceRef.current) clearTimeout(sugDebounceRef.current);
    sugDebounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
  }

  function selectSuggestion(label: string) {
    setKeywordInput(label);
    setKeyword(label);
    setSuggestionsOpen(false);
    setSuggestions([]);
  }

  function clearKeyword() {
    setKeywordInput("");
    setKeyword("");
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function handleSugKeyDown(e: React.KeyboardEvent) {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (keywordInput.length >= 2) {
          setKeyword(keywordInput);
          setSuggestionsOpen(false);
        }
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSugHighlight((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSugHighlight((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sugHighlight >= 0 && suggestions[sugHighlight]) {
        selectSuggestion(suggestions[sugHighlight].label);
      } else if (keywordInput.length >= 2) {
        setKeyword(keywordInput);
        setSuggestionsOpen(false);
      }
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sugWrapperRef.current && !sugWrapperRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { load(1); }, [load]);

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Track all changes across employees, assets, and plant."
      />

      {/* Keyword search filter */}
      <div className="mb-4" ref={sugWrapperRef}>
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => handleKeywordInput(e.target.value)}
            onKeyDown={handleSugKeyDown}
            onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
            placeholder="Filter by name, plant number, asset..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {keyword && (
            <button
              type="button"
              onClick={clearKeyword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {suggestionsOpen && keywordInput.length >= 2 && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border shadow-lg z-50 max-h-60 overflow-y-auto overscroll-none">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.type}-${s.label}`}
                  onClick={() => selectSuggestion(s.label)}
                  onMouseEnter={() => setSugHighlight(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b last:border-b-0 transition-colors ${i === sugHighlight ? "bg-blue-50" : "hover:bg-blue-50"}`}
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                    ENTITY_COLORS[s.type] || "bg-gray-100 text-gray-600"
                  }`}>
                    {s.type}
                  </span>
                  <span className="text-sm text-gray-900 truncate">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {keyword && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtered to:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              {keyword}
              <button type="button" onClick={clearKeyword} className="hover:text-blue-900">&times;</button>
            </span>
          </div>
        )}
      </div>

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
        {(entityType || action || keyword) && (
          <button
            onClick={() => { setEntityType(""); setAction(""); clearKeyword(); }}
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
                  {timeAgo(log.performedAt)}
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
