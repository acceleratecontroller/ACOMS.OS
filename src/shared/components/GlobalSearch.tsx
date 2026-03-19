"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "employee" | "asset" | "plant";
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_LABELS: Record<string, string> = {
  employee: "Employee",
  asset: "Asset",
  plant: "Plant",
};

const TYPE_COLORS: Record<string, string> = {
  employee: "bg-blue-100 text-blue-700",
  asset: "bg-green-100 text-green-700",
  plant: "bg-orange-100 text-orange-700",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [archived, setArchived] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const router = useRouter();

  const search = useCallback((term: string, showArchived: boolean) => {
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ q: term });
    if (showArchived) params.set("archived", "true");
    fetch(`/api/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value, archived), 250);
  }

  function toggleArchived() {
    const next = !archived;
    setArchived(next);
    if (query.length >= 2) {
      search(query, next);
    }
  }

  function handleSelect(result: SearchResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
    router.push(result.href);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => { if (query.length >= 2) setOpen(true); }}
            placeholder={archived ? "Search archived records..." : "Search employees, assets, plant..."}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={toggleArchived}
          className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            archived
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {archived ? "Archived" : "Active"}
        </button>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border shadow-lg z-50 max-h-80 overflow-y-auto overscroll-none">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results found.</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors flex items-center gap-3 border-b last:border-b-0"
            >
              <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${TYPE_COLORS[r.type]}`}>
                {TYPE_LABELS[r.type]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                <div className="text-xs text-gray-500">{r.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
