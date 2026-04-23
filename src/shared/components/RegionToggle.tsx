"use client";

import type { Location } from "@prisma/client";
import { LOCATION_OPTIONS } from "@/config/constants";

interface Props {
  selected: Location[];
  onChange: (next: Location[]) => void;
}

/**
 * Multi-select region/depot toggle. No buttons selected = show everything;
 * any selection narrows results to those regions only.
 */
export default function RegionToggle({ selected, onChange }: Props) {
  function toggle(value: Location) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {LOCATION_OPTIONS.map((opt) => {
        const value = opt.value as Location;
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              on
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            aria-pressed={on}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pure helper: filter rows by their `location` field against the selected
 * regions. Empty selection = no filter (everything passes).
 */
export function filterByRegion<T extends { location?: Location | null }>(
  rows: T[],
  selected: Location[],
): T[] {
  if (selected.length === 0) return rows;
  return rows.filter((r) => r.location != null && selected.includes(r.location));
}
