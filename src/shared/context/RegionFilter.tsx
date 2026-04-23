"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Location } from "@prisma/client";

interface Ctx {
  selectedRegions: Location[];
  setSelectedRegions: (next: Location[]) => void;
}

const RegionFilterContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "acoms.regionFilter";

export function RegionFilterProvider({ children }: { children: ReactNode }) {
  const [selectedRegions, setState] = useState<Location[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage post-mount avoids SSR mismatch
      if (Array.isArray(parsed)) setState(parsed as Location[]);
    } catch {
      // ignore parse errors
    }
  }, []);

  function setSelectedRegions(next: Location[]) {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }

  return (
    <RegionFilterContext.Provider value={{ selectedRegions, setSelectedRegions }}>
      {children}
    </RegionFilterContext.Provider>
  );
}

export function useRegionFilter(): Ctx {
  const ctx = useContext(RegionFilterContext);
  if (!ctx) throw new Error("useRegionFilter must be used inside RegionFilterProvider");
  return ctx;
}
