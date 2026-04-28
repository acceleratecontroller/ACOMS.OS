"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface TagOption {
  id: string;
  name: string;
  useCount?: number;
}

interface Props {
  /** Currently selected option id, or "" for none. */
  value: string;
  onChange: (id: string, name: string) => void;
  /** REST endpoint used as the data source. Must support GET (?q=), POST { name }, PATCH { name }, DELETE. */
  endpoint: string;
  placeholder?: string;
  emptyHint?: string;
  /** Called to refresh the asset's `defaultValueLabel` after rename. */
  onListChange?: () => void;
  required?: boolean;
  disabled?: boolean;
  /** Initial display label so the input shows the current value before /list completes. */
  initialLabel?: string | null;
  /** name attribute — written to a hidden input so plain HTML form submits work. */
  name?: string;
}

export default function TagComboBox({
  value,
  onChange,
  endpoint,
  placeholder = "Search or create...",
  emptyHint,
  onListChange,
  required,
  disabled,
  initialLabel,
  name,
}: Props) {
  const [options, setOptions] = useState<TagOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Local label for the selected value so the input shows current selection
  const selected = options.find((o) => o.id === value);
  const displayLabel = selected?.name ?? initialLabel ?? "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data: TagOption[] = await res.json();
      setOptions(data);
    } catch {
      // ignore
    }
  }, [endpoint]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount populates options via setState, by design
  useEffect(() => { load(); }, [load]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = trimmed
    ? options.filter((o) => o.name.toLowerCase().includes(lower))
    : options;
  const exactMatch = options.find((o) => o.name.toLowerCase() === lower);
  const canCreate = !!trimmed && !exactMatch;

  async function handleCreate() {
    if (!trimmed) return;
    setError("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to create");
      return;
    }
    const created: TagOption = await res.json();
    await load();
    onChange(created.id, created.name);
    onListChange?.();
    setQuery("");
    setOpen(false);
  }

  async function handleSelect(opt: TagOption) {
    onChange(opt.id, opt.name);
    setQuery("");
    setOpen(false);
  }

  async function handleRename(id: string) {
    const next = editingValue.trim();
    if (!next) {
      setEditingId(null);
      return;
    }
    setError("");
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to rename");
      return;
    }
    const updated: TagOption = await res.json();
    if (id === value) onChange(updated.id, updated.name);
    setEditingId(null);
    setEditingValue("");
    await load();
    onListChange?.();
  }

  async function handleDelete(id: string) {
    setError("");
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to delete");
      return;
    }
    if (id === value) onChange("", "");
    await load();
    onListChange?.();
  }

  return (
    <div ref={wrapperRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <input
        type="text"
        value={open ? query : displayLabel}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); setEditingId(null); }
          if (e.key === "Enter" && canCreate) {
            e.preventDefault();
            handleCreate();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 ${
          disabled ? "bg-gray-50 text-gray-400" : "bg-white border-gray-300"
        }`}
      />

      {open && !disabled && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {error && <p className="px-3 py-1.5 text-xs text-red-600 border-b border-red-100 bg-red-50">{error}</p>}
          {filtered.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-xs text-gray-400">{emptyHint || "No matches"}</p>
          )}
          {filtered.map((opt) => (
            <div
              key={opt.id}
              className={`group flex items-center gap-1 px-2 py-1 hover:bg-gray-50 ${opt.id === value ? "bg-blue-50/50" : ""}`}
            >
              {editingId === opt.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleRename(opt.id); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-2 py-0.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => handleRename(opt.id)} className="text-xs text-blue-600 hover:text-blue-800 px-1.5">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-1.5">Cancel</button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className="flex-1 text-left px-1 py-0.5 text-sm text-gray-800"
                  >
                    {opt.name}
                    {opt.useCount !== undefined && opt.useCount > 0 && (
                      <span className="ml-1.5 text-[10px] text-gray-400">· {opt.useCount}</span>
                    )}
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingId(opt.id); setEditingValue(opt.name); setError(""); }}
                      className="text-[11px] text-gray-500 hover:text-gray-700 px-1"
                      title="Rename"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(opt.id); }}
                      disabled={(opt.useCount ?? 0) > 0}
                      className={`text-[11px] px-1 ${
                        (opt.useCount ?? 0) > 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-red-500 hover:text-red-700"
                      }`}
                      title={(opt.useCount ?? 0) > 0 ? `Used by ${opt.useCount} asset${opt.useCount === 1 ? "" : "s"}` : "Delete"}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center gap-1.5"
            >
              <span className="font-bold">+</span>
              <span>Create &ldquo;{trimmed}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
