"use client";

import RegionToggle from "./RegionToggle";
import { useRegionFilter } from "@/shared/context/RegionFilter";

export default function GlobalRegionToggle() {
  const { selectedRegions, setSelectedRegions } = useRegionFilter();
  return <RegionToggle selected={selectedRegions} onChange={setSelectedRegions} />;
}
