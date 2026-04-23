"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { Location } from "@prisma/client";
import { Modal } from "@/shared/components/Modal";
import { filterByRegion } from "@/shared/components/RegionToggle";
import { useRegionFilter } from "@/shared/context/RegionFilter";
import { ACCREDITATION_STATUS_LABELS } from "@/config/constants";

// ─── Tree view types ───────────────────────────────────
interface AccreditationNode {
  id: string;
  accreditationNumber: string;
  name: string;
  isArchived: boolean;
}

interface SkillNode {
  id: string;
  skillNumber: string;
  name: string;
  isArchived: boolean;
  accreditationLinks: { accreditation: AccreditationNode }[];
}

interface RoleNode {
  id: string;
  roleNumber: string;
  name: string;
  category: string;
  skillLinks: { skill: SkillNode }[];
}

interface TreeData {
  roles: RoleNode[];
  unlinkedSkills: (SkillNode & { accreditationLinks: { accreditation: AccreditationNode }[] })[];
  unlinkedAccreditations: AccreditationNode[];
}

// ─── Employee view types ───────────────────────────────
interface AccredDef {
  id: string;
  accreditationNumber: string;
  name: string;
  expires: boolean;
  renewalMonths: number | null;
}

interface EmployeeAccred {
  id: string;
  accreditation: AccredDef;
  status: string;
  required: boolean;
  expiryDate: string | null;
  certificateNumber: string | null;
  notes: string | null;
}

interface EmployeeRole {
  role: {
    id: string;
    roleNumber: string;
    name: string;
    skillLinks: { required: boolean; skill: { id: string; skillNumber: string; name: string; accreditationLinks: { accreditation: AccredDef; required: boolean }[] } }[];
  };
}

interface EmployeeRow {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  location: Location;
  trainingRoles: EmployeeRole[];
  accreditations: EmployeeAccred[];
}

type View = "tree" | "employees";
type ComplianceFilter = "all" | "expired" | "missing_pending" | "expiring_soon" | "compliant";

// ─── Status colours ────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-red-100 text-red-700",
  EXEMPT: "bg-blue-100 text-blue-700",
  MISSING: "bg-gray-100 text-gray-500",
  EXPIRY_PASSED: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS = ["PENDING", "VERIFIED", "EXPIRED", "EXEMPT"] as const;

// ─── Per-accreditation edit state ──────────────────────
interface AccredEditRow {
  accreditationId: string;
  accreditationName: string;
  accreditationNumber: string;
  expires: boolean;
  renewalMonths: number | null;
  recordId: string | null;
  status: string;
  required: boolean; // Required vs Other
  expiryDate: string;
  certificateNumber: string;
  notes: string;
  dirty: boolean;
  standalone: boolean; // true when not linked to any role-required skill
}

// ─── Enriched employee for list rendering ──────────────
interface EnrichedEmployee {
  emp: EmployeeRow;
  pct: number;
  total: number;
  compliant: number;
  expiredCount: number;
  expiringSoonCount: number;
  missingCount: number;
  pendingCount: number;
  otherExpiredCount: number;
  otherExpiringSoonCount: number;
}

// ─── Date helpers ──────────────────────────────────────
const EXPIRY_SOON_DAYS = 30;

function isDateExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDateExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soonDate = new Date(today);
  soonDate.setDate(soonDate.getDate() + EXPIRY_SOON_DAYS);
  return d >= today && d <= soonDate;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEffectiveStatus(held: EmployeeAccred): string {
  if (held.status === "EXEMPT") return "EXEMPT";
  if (held.status === "VERIFIED" && held.accreditation.expires && isDateExpired(held.expiryDate)) {
    return "EXPIRY_PASSED";
  }
  return held.status;
}

function isEffectivelyCompliant(held: EmployeeAccred): boolean {
  const eff = getEffectiveStatus(held);
  return eff === "VERIFIED" || eff === "EXEMPT";
}

// ─── Search match helpers ──────────────────────────────
type MatchHealth = "compliant" | "expiring_soon" | "expired" | "pending" | "missing";

interface SearchMatch {
  kind: "role" | "skill" | "accreditation";
  label: string;
  required?: boolean; // accreditation-only: false means "Other" (nice to have)
  health?: MatchHealth;
  healthLabel?: string;
}

const HEALTH_STYLES: Record<MatchHealth, string> = {
  compliant: "bg-green-100 text-green-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-800",
  missing: "bg-red-100 text-red-700",
};

function getHeldHealth(held: EmployeeAccred): { health: MatchHealth; label: string } {
  if (held.status === "PENDING") return { health: "pending", label: "Pending" };
  if (held.status === "VERIFIED") {
    if (held.accreditation.expires && isDateExpired(held.expiryDate)) {
      return { health: "expired", label: "Expired" };
    }
    if (held.accreditation.expires && isDateExpiringSoon(held.expiryDate)) {
      return { health: "expiring_soon", label: "Expiring Soon" };
    }
    return { health: "compliant", label: "In Date" };
  }
  if (held.status === "EXPIRED") return { health: "expired", label: "Expired" };
  return { health: "pending", label: held.status };
}

function computeSearchMatches(emp: EmployeeRow, q: string): SearchMatch[] {
  if (!q) return [];
  const matches: SearchMatch[] = [];
  const seenRoles = new Set<string>();
  const seenSkills = new Set<string>();
  const seenAccreds = new Set<string>();

  for (const tr of emp.trainingRoles) {
    if (seenRoles.has(tr.role.id)) continue;
    if (tr.role.roleNumber.toLowerCase().includes(q) || tr.role.name.toLowerCase().includes(q)) {
      matches.push({ kind: "role", label: tr.role.name });
      seenRoles.add(tr.role.id);
    }
  }

  for (const tr of emp.trainingRoles) {
    for (const sl of tr.role.skillLinks) {
      if (seenSkills.has(sl.skill.id)) continue;
      if (sl.skill.name.toLowerCase().includes(q)) {
        matches.push({ kind: "skill", label: sl.skill.name });
        seenSkills.add(sl.skill.id);
      }
    }
  }

  // Linked accreditations via role→skill→accreditation. Effective flag is
  // AND across both link levels; Required wins across paths.
  const linkedAccreds = new Map<string, { accred: AccredDef; required: boolean }>();
  for (const tr of emp.trainingRoles) {
    for (const sl of tr.role.skillLinks) {
      for (const al of sl.skill.accreditationLinks) {
        const effective = sl.required && al.required;
        const existing = linkedAccreds.get(al.accreditation.id);
        if (!existing || (!existing.required && effective)) {
          linkedAccreds.set(al.accreditation.id, { accred: al.accreditation, required: effective });
        }
      }
    }
  }
  const heldById = new Map(emp.accreditations.map((ea) => [ea.accreditation.id, ea]));

  // Held accreditations.
  // VERIFIED and EXPIRED are real evidence and always count.
  // PENDING only counts if it's still linked to their current roles
  // (hides legacy orphans). EXEMPT never counts as a search match.
  // Required/Other is the skill link's flag when linked, otherwise EA.required.
  for (const ea of emp.accreditations) {
    if (seenAccreds.has(ea.accreditation.id)) continue;
    if (ea.status === "EXEMPT") continue;
    const linkedInfo = linkedAccreds.get(ea.accreditation.id);
    if (ea.status === "PENDING" && !linkedInfo) continue;
    const nameHit =
      ea.accreditation.accreditationNumber.toLowerCase().includes(q) ||
      ea.accreditation.name.toLowerCase().includes(q);
    if (!nameHit) continue;
    const { health, label } = getHeldHealth(ea);
    matches.push({
      kind: "accreditation",
      label: `${ea.accreditation.accreditationNumber} — ${ea.accreditation.name}`,
      required: linkedInfo ? linkedInfo.required : ea.required,
      health,
      healthLabel: label,
    });
    seenAccreds.add(ea.accreditation.id);
  }

  // Linked via role but no record (missing)
  for (const [id, info] of linkedAccreds) {
    if (seenAccreds.has(id)) continue;
    const held = heldById.get(id);
    if (held) continue;
    const nameHit =
      info.accred.accreditationNumber.toLowerCase().includes(q) ||
      info.accred.name.toLowerCase().includes(q);
    if (!nameHit) continue;
    matches.push({
      kind: "accreditation",
      label: `${info.accred.accreditationNumber} — ${info.accred.name}`,
      required: info.required,
      health: "missing",
      healthLabel: "Missing",
    });
    seenAccreds.add(id);
  }

  return matches;
}

// Build the "effective required" map for an employee: for any accreditation
// currently linked via a role→skill→accreditation chain, the effective flag
// is the AND of the role-skill and skill-accreditation flags. Required wins
// across multiple paths to the same accreditation. For accreditations not
// currently linked (standalone), fall back to EmployeeAccreditation.required.
function buildEffectiveRequiredMap(emp: EmployeeRow): Map<string, boolean> {
  const linked = new Map<string, boolean>();
  emp.trainingRoles.forEach((tr) => {
    tr.role.skillLinks.forEach((sl) => {
      sl.skill.accreditationLinks.forEach((al) => {
        const effective = sl.required && al.required;
        const cur = linked.get(al.accreditation.id);
        if (cur === true) return;
        linked.set(al.accreditation.id, effective);
      });
    });
  });
  return linked;
}

function effectiveRequired(
  ea: EmployeeAccred,
  linkedMap: Map<string, boolean>,
): boolean {
  const fromLink = linkedMap.get(ea.accreditation.id);
  return fromLink !== undefined ? fromLink : ea.required;
}

// ─── Compliance computation ────────────────────────────
// Only Required accreditations count toward compliance — Other rows are
// tracked separately (see otherExpiredCount / otherExpiringSoonCount).
// "Required" here is driven by the skill link when linked, and by the stored
// EmployeeAccreditation.required when standalone.
function computeCompliance(emp: EmployeeRow) {
  const linkedRequiredMap = buildEffectiveRequiredMap(emp);
  const requiredAccredIds = new Set<string>();
  linkedRequiredMap.forEach((required, accredId) => {
    if (required) requiredAccredIds.add(accredId);
  });

  const heldMap = new Map(emp.accreditations.map((ea) => [ea.accreditation.id, ea]));
  const total = requiredAccredIds.size;
  let compliant = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;

  requiredAccredIds.forEach((id) => {
    const held = heldMap.get(id);
    if (held) {
      if (isEffectivelyCompliant(held)) compliant++;
      if (held.accreditation.expires) {
        if (isDateExpired(held.expiryDate)) expiredCount++;
        else if (isDateExpiringSoon(held.expiryDate)) expiringSoonCount++;
      }
    }
  });

  // Other accreditations — expiration tracking only (no compliance effect).
  // Use effective required so a skill-linked row whose skill says Other is
  // correctly counted as Other even if EA.required stored otherwise.
  let otherExpiredCount = 0;
  let otherExpiringSoonCount = 0;
  emp.accreditations.forEach((ea) => {
    if (effectiveRequired(ea, linkedRequiredMap)) return;
    if (!ea.accreditation.expires) return;
    if (ea.status !== "VERIFIED") return;
    if (isDateExpired(ea.expiryDate)) otherExpiredCount++;
    else if (isDateExpiringSoon(ea.expiryDate)) otherExpiringSoonCount++;
  });

  const pct = total > 0 ? Math.round((compliant / total) * 100) : 100;
  return {
    requiredAccredIds,
    heldMap,
    pct,
    total,
    compliant,
    expiredCount,
    expiringSoonCount,
    otherExpiredCount,
    otherExpiringSoonCount,
  };
}

function enrichEmployee(emp: EmployeeRow): EnrichedEmployee {
  const c = computeCompliance(emp);
  let missingCount = 0;
  let pendingCount = 0;
  c.requiredAccredIds.forEach((id) => {
    const held = c.heldMap.get(id);
    if (!held) missingCount++;
    else if (held.status === "PENDING") pendingCount++;
  });
  return {
    emp,
    pct: c.pct,
    total: c.total,
    compliant: c.compliant,
    expiredCount: c.expiredCount,
    expiringSoonCount: c.expiringSoonCount,
    missingCount,
    pendingCount,
    otherExpiredCount: c.otherExpiredCount,
    otherExpiringSoonCount: c.otherExpiringSoonCount,
  };
}

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

// ═══════════════════════════════════════════════════════
export function MatrixTab() {
  const [view, setView] = useState<View>("employees");
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback((v: View, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    fetch(`/api/training/matrix?view=${v}`)
      .then((r) => r.json())
      .then((d) => {
        if (v === "tree") setTreeData(d);
        else setEmployees(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(view); }, [view, loadData]);

  function handleModalClose() {
    setSelectedEmployee(null);
    if (view === "employees") loadData("employees", false);
  }

  function toggleFilter(f: ComplianceFilter) {
    setComplianceFilter((prev) => (prev === f ? "all" : f));
  }

  return (
    <>
      {/* Segmented control + search */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {view === "employees" ? (
          <input
            type="search"
            placeholder="Search role, skill, or accreditation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        ) : (
          <div />
        )}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            onClick={() => setView("employees")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "employees"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Employee Compliance
          </button>
          <button
            onClick={() => setView("tree")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "tree"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Structure
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : view === "tree" ? (
        <TreeView data={treeData} />
      ) : (
        <EmployeeComplianceView
          employees={employees}
          onEmployeeClick={setSelectedEmployee}
          filter={complianceFilter}
          onFilterToggle={toggleFilter}
          searchQuery={searchQuery}
          onSearchClear={() => setSearchQuery("")}
        />
      )}

      {selectedEmployee && (
        <ComplianceModal employee={selectedEmployee} onClose={handleModalClose} />
      )}
    </>
  );
}

// ─── Required vs Other pill toggle ─────────────────────
function RequiredOtherPill({ required, onChange }: { required: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-[11px] font-medium">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2 py-0.5 transition-colors ${
          required ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        Required
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2 py-0.5 transition-colors ${
          !required ? "bg-gray-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        Other
      </button>
    </div>
  );
}

// ─── Match Chips ────────────────────────────────────────
function MatchChips({ matches }: { matches: SearchMatch[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {matches.map((m, i) => {
        if (m.kind === "accreditation" && m.health && m.healthLabel) {
          const isOther = m.required === false;
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${HEALTH_STYLES[m.health]}`}
              title={`Accreditation · ${m.healthLabel}${isOther ? " · Other" : ""}`}
            >
              <span>{m.label}</span>
              <span className="opacity-70">·</span>
              <span>{m.healthLabel}</span>
              {isOther && <span className="opacity-70 italic">· Other</span>}
            </span>
          );
        }
        const typeStyle = m.kind === "role"
          ? "bg-blue-100 text-blue-700"
          : "bg-indigo-100 text-indigo-700";
        const prefix = m.kind === "role" ? "Role" : "Skill";
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${typeStyle}`}
          >
            <span className="opacity-70">{prefix}:</span>
            <span>{m.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────
function MetricCard({ label, value, accent, active, onClick }: {
  label: string;
  value: string | number;
  accent?: "red" | "amber" | "green" | "neutral";
  active?: boolean;
  onClick?: () => void;
}) {
  const accentStyles = {
    red: "border-red-200 bg-red-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    green: "border-green-200 bg-green-50/50",
    neutral: "border-gray-200 bg-white",
  };
  const valueStyles = {
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
    neutral: "text-gray-900",
  };
  const a = accent || "neutral";

  return (
    <button
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-lg border transition-all ${accentStyles[a]} ${
        active ? "ring-2 ring-blue-500 ring-offset-1" : "hover:shadow-sm"
      }`}
    >
      <div className={`text-xl font-semibold tabular-nums ${valueStyles[a]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </button>
  );
}

// ─── Employee Compliance View ──────────────────────────
function EmployeeComplianceView({ employees, onEmployeeClick, filter, onFilterToggle, searchQuery, onSearchClear }: {
  employees: EmployeeRow[];
  onEmployeeClick: (emp: EmployeeRow) => void;
  filter: ComplianceFilter;
  onFilterToggle: (f: ComplianceFilter) => void;
  searchQuery: string;
  onSearchClear: () => void;
}) {
  const { selectedRegions } = useRegionFilter();

  const regionFiltered = useMemo(
    () => filterByRegion(employees, selectedRegions),
    [employees, selectedRegions],
  );

  const withMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return regionFiltered.map((emp) => ({ emp, matches: computeSearchMatches(emp, q) }));
  }, [regionFiltered, searchQuery]);

  const searchFiltered = useMemo(
    () => (searchQuery.trim() ? withMatches.filter((r) => r.matches.length > 0) : withMatches),
    [withMatches, searchQuery],
  );

  const enriched = useMemo(
    () => searchFiltered.map(({ emp, matches }) => ({ ...enrichEmployee(emp), matches })),
    [searchFiltered],
  );

  // Aggregate stats (Required only for compliance; Other tracked separately)
  const stats = useMemo(() => {
    let expired = 0, missingPending = 0, expiringSoon = 0, compliant = 0, needsAttention = 0, totalPct = 0;
    let otherExpired = 0, otherExpiringSoon = 0;
    for (const e of enriched) {
      if (e.expiredCount > 0) expired++;
      if (e.missingCount > 0 || e.pendingCount > 0) missingPending++;
      if (e.expiringSoonCount > 0) expiringSoon++;
      if (e.pct === 100) compliant++;
      if (e.expiredCount > 0 || e.missingCount > 0 || e.pendingCount > 0) needsAttention++;
      if (e.otherExpiredCount > 0) otherExpired++;
      if (e.otherExpiringSoonCount > 0) otherExpiringSoon++;
      totalPct += e.pct;
    }
    const overallPct = enriched.length > 0 ? Math.round(totalPct / enriched.length) : 100;
    return {
      total: enriched.length,
      expired,
      missingPending,
      expiringSoon,
      compliant,
      needsAttention,
      overallPct,
      otherExpired,
      otherExpiringSoon,
    };
  }, [enriched]);

  // Filter + sort (worst compliance first)
  const filtered = useMemo(() => {
    const list = enriched.filter((e) => {
      switch (filter) {
        case "expired": return e.expiredCount > 0;
        case "missing_pending": return e.missingCount > 0 || e.pendingCount > 0;
        case "expiring_soon": return e.expiringSoonCount > 0;
        case "compliant": return e.pct === 100;
        default: return true;
      }
    });
    return list.sort((a, b) => a.pct - b.pct);
  }, [enriched, filter]);

  if (employees.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No active employees found.</div>;
  }

  const issueCount = stats.needsAttention;
  const complianceAccent: "green" | "amber" | "red" = stats.overallPct >= 90 ? "green" : stats.overallPct >= 50 ? "amber" : "red";

  const activeQuery = searchQuery.trim();

  return (
    <div className="space-y-4">
      {/* Search results banner */}
      {activeQuery && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
          <span>
            Showing <span className="font-semibold">{enriched.length}</span> of {regionFiltered.length}{" "}
            employee{regionFiltered.length === 1 ? "" : "s"} matching{" "}
            <span className="font-semibold">&ldquo;{activeQuery}&rdquo;</span>
          </span>
          <button
            type="button"
            onClick={onSearchClear}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Total Employees"
          value={stats.total}
          active={filter === "all"}
          onClick={() => onFilterToggle("all")}
        />
        <MetricCard
          label="Expired"
          value={stats.expired}
          accent={stats.expired > 0 ? "red" : "neutral"}
          active={filter === "expired"}
          onClick={() => onFilterToggle("expired")}
        />
        <MetricCard
          label="Missing / Pending"
          value={stats.missingPending}
          accent={stats.missingPending > 0 ? "amber" : "neutral"}
          active={filter === "missing_pending"}
          onClick={() => onFilterToggle("missing_pending")}
        />
        <MetricCard
          label="Expiring Soon"
          value={stats.expiringSoon}
          accent={stats.expiringSoon > 0 ? "amber" : "neutral"}
          active={filter === "expiring_soon"}
          onClick={() => onFilterToggle("expiring_soon")}
        />
        <MetricCard
          label="Overall Compliance"
          value={`${stats.overallPct}%`}
          accent={complianceAccent}
          active={filter === "compliant"}
          onClick={() => onFilterToggle("compliant")}
        />
      </div>

      {/* Other accreditation expiration tracking (not required = not counted
          toward compliance, but still worth knowing about). */}
      {(stats.otherExpired > 0 || stats.otherExpiringSoon > 0) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Other</span>
          {stats.otherExpired > 0 && (
            <span>
              <span className="text-red-600 font-medium">{stats.otherExpired}</span> employee
              {stats.otherExpired === 1 ? "" : "s"} with expired non-required accreditation
              {stats.otherExpired === 1 ? "" : "s"}
            </span>
          )}
          {stats.otherExpired > 0 && stats.otherExpiringSoon > 0 && <span className="text-gray-300">·</span>}
          {stats.otherExpiringSoon > 0 && (
            <span>
              <span className="text-amber-600 font-medium">{stats.otherExpiringSoon}</span> with non-required expiring soon
            </span>
          )}
        </div>
      )}

      {/* Inline notice */}
      {issueCount > 0 && filter === "all" && (
        <p className="text-sm text-gray-500">
          <span className="text-red-600 font-medium">{issueCount} employee{issueCount !== 1 ? "s" : ""}</span> require attention
        </p>
      )}

      {/* Employee table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Desktop table header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_140px_120px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Employee</span>
          <span>Roles</span>
          <span>Compliance</span>
          <span>Issues</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No employees match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(({ emp, pct, total, compliant, expiredCount, expiringSoonCount, missingCount, pendingCount, matches }) => {
              const barColor = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500";
              const issueLabel = getIssueLabel(expiredCount, missingCount, pendingCount, expiringSoonCount);

              return (
                <div
                  key={emp.id}
                  className="group cursor-pointer hover:bg-gray-50/80 transition-colors"
                  onClick={() => onEmployeeClick(emp)}
                >
                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_140px_120px] gap-4 px-4 py-3 items-start">
                    {/* Employee */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400 shrink-0">{emp.employeeNumber}</span>
                        <span className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</span>
                      </div>
                      {matches.length > 0 && <MatchChips matches={matches} />}
                    </div>

                    {/* Roles */}
                    <div className="text-sm text-gray-500 truncate">
                      {emp.trainingRoles.length > 0
                        ? emp.trainingRoles.map((tr) => tr.role.name).join(", ")
                        : <span className="text-gray-300">No roles</span>
                      }
                    </div>

                    {/* Compliance bar + percentage */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`${barColor} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-medium tabular-nums w-9 text-right ${
                        pct === 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {pct}%
                      </span>
                    </div>

                    {/* Issues */}
                    <div className="text-xs">
                      {issueLabel ? (
                        <span className={issueLabel.color}>{issueLabel.text}</span>
                      ) : (
                        <span className="text-green-600">{compliant}/{total} passed</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div className="sm:hidden px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-gray-400 mr-1.5">{emp.employeeNumber}</span>
                        <span className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</span>
                        {matches.length > 0 && <MatchChips matches={matches} />}
                      </div>
                      <span className={`text-xs font-medium tabular-nums ${
                        pct === 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`${barColor} h-full rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      {issueLabel && (
                        <span className={`text-xs shrink-0 ${issueLabel.color}`}>{issueLabel.text}</span>
                      )}
                    </div>
                    {emp.trainingRoles.length > 0 && (
                      <div className="text-xs text-gray-400 truncate">
                        {emp.trainingRoles.map((tr) => tr.role.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {enriched.length} employee{enriched.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function getIssueLabel(expired: number, missing: number, pending: number, expiringSoon: number): { text: string; color: string } | null {
  const total = expired + missing + pending + expiringSoon;
  if (total === 0) return null;
  const color = expired > 0 ? "text-red-600 font-medium" : "text-amber-600 font-medium";
  return { text: `${total} issue${total !== 1 ? "s" : ""}`, color };
}

// ─── Tree View ─────────────────────────────────────────
function TreeView({ data }: { data: TreeData | null }) {
  if (!data) return null;

  const hasContent = data.roles.length > 0 || data.unlinkedSkills.length > 0 || data.unlinkedAccreditations.length > 0;
  if (!hasContent) {
    return <div className="text-center py-12 text-gray-400 text-sm">No training data configured yet. Start by creating roles, skills, and accreditations.</div>;
  }

  return (
    <div className="space-y-3">
      {data.roles.map((role) => (
        <div key={role.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-mono text-gray-400">{role.roleNumber}</span>
            <h3 className="text-sm font-semibold text-gray-900">{role.name}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{role.category === "OFFICE" ? "Office" : "Field"}</span>
          </div>
          {role.skillLinks.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">No skills linked</p>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {role.skillLinks.map((sl) => (
                <div key={sl.skill.id} className="border-l-2 border-gray-200 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{sl.skill.skillNumber}</span>
                    <span className="text-sm text-gray-700">{sl.skill.name}</span>
                  </div>
                  {sl.skill.accreditationLinks.length > 0 && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {sl.skill.accreditationLinks.map((al) => (
                        <div key={al.accreditation.id} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-mono text-gray-400">{al.accreditation.accreditationNumber}</span>
                          <span>{al.accreditation.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {data.unlinkedSkills.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-amber-700 mb-2">Unlinked Skills</h3>
          <ul className="space-y-1">
            {data.unlinkedSkills.map((s) => (
              <li key={s.id} className="text-xs text-gray-600">{s.skillNumber} — {s.name}</li>
            ))}
          </ul>
        </div>
      )}

      {data.unlinkedAccreditations.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-amber-700 mb-2">Unlinked Accreditations</h3>
          <ul className="space-y-1">
            {data.unlinkedAccreditations.map((a) => (
              <li key={a.id} className="text-xs text-gray-600">{a.accreditationNumber} — {a.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Compliance Edit Modal ─────────────────────────────
function ComplianceModal({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const [rows, setRows] = useState<AccredEditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [modalSearch, setModalSearch] = useState("");

  // "+ Add Accreditation" inline form state
  const [allAccreds, setAllAccreds] = useState<{ id: string; accreditationNumber: string; name: string; expires: boolean; renewalMonths: number | null; isArchived?: boolean }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addAccredId, setAddAccredId] = useState("");
  const [addStatus, setAddStatus] = useState<"VERIFIED" | "EXPIRED">("VERIFIED");
  const [addRequired, setAddRequired] = useState(true);
  const [addExpiry, setAddExpiry] = useState("");
  const [addCert, setAddCert] = useState("");
  const [addQuery, setAddQuery] = useState("");

  useEffect(() => {
    fetch("/api/training/accreditations")
      .then((r) => r.ok ? r.json() : [])
      .then(setAllAccreds)
      .catch(() => {});
  }, []);

  function resetAddForm() {
    setAddOpen(false);
    setAddAccredId("");
    setAddStatus("VERIFIED");
    setAddRequired(true);
    setAddExpiry("");
    setAddCert("");
    setAddQuery("");
  }

  useEffect(() => {
    const heldMap = new Map(employee.accreditations.map((ea) => [ea.accreditation.id, ea]));

    // Linked accreditations via role→skill→accreditation. Effective flag is
    // the AND of role-skill and skill-accreditation. Required wins across paths.
    const linkedMap = new Map<string, { def: AccredDef; required: boolean }>();
    employee.trainingRoles.forEach((tr) => {
      tr.role.skillLinks.forEach((sl) => {
        sl.skill.accreditationLinks.forEach((al) => {
          const effective = sl.required && al.required;
          const existing = linkedMap.get(al.accreditation.id);
          if (!existing || (!existing.required && effective)) {
            linkedMap.set(al.accreditation.id, { def: al.accreditation, required: effective });
          }
        });
      });
    });

    const editRows: AccredEditRow[] = [];

    // Linked (role-required) rows — skill link is the source of truth for
    // the Required/Other classification, not EA.required.
    linkedMap.forEach(({ def, required }, accredId) => {
      const held = heldMap.get(accredId);
      editRows.push({
        accreditationId: accredId,
        accreditationName: def.name,
        accreditationNumber: def.accreditationNumber,
        expires: def.expires,
        renewalMonths: def.renewalMonths,
        recordId: held?.id || null,
        status: held?.status || "MISSING",
        required,
        expiryDate: formatDate(held?.expiryDate || null),
        certificateNumber: held?.certificateNumber || "",
        notes: held?.notes || "",
        dirty: false,
        standalone: false,
      });
    });

    // Standalone rows — the employee has an EmployeeAccreditation record
    // that isn't linked to any current role→skill chain.
    employee.accreditations.forEach((ea) => {
      if (linkedMap.has(ea.accreditation.id)) return;
      editRows.push({
        accreditationId: ea.accreditation.id,
        accreditationName: ea.accreditation.name,
        accreditationNumber: ea.accreditation.accreditationNumber,
        expires: ea.accreditation.expires,
        renewalMonths: ea.accreditation.renewalMonths,
        recordId: ea.id,
        status: ea.status,
        required: ea.required,
        expiryDate: formatDate(ea.expiryDate),
        certificateNumber: ea.certificateNumber || "",
        notes: ea.notes || "",
        dirty: false,
        standalone: true,
      });
    });

    setRows(editRows);
  }, [employee]);

  function updateRow<K extends keyof AccredEditRow>(idx: number, field: K, value: AccredEditRow[K]) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value, dirty: true } : r))
    );
  }

  async function handleDeleteStandalone(recordId: string) {
    if (!confirm("Remove this standalone accreditation from the employee?")) return;
    const res = await fetch(`/api/training/employees/${employee.id}/accreditations/${recordId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.recordId !== recordId));
    } else {
      setError("Failed to remove accreditation");
    }
  }

  async function handleAddAccreditation() {
    if (!addAccredId) return;
    setError("");
    const accred = allAccreds.find((a) => a.id === addAccredId);
    const res = await fetch(`/api/training/employees/${employee.id}/accreditations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accreditationId: addAccredId,
        status: addStatus,
        required: addRequired,
        expiryDate: addExpiry || null,
        certificateNumber: addCert || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to add accreditation");
      return;
    }
    const created = await res.json();
    setRows((prev) => [
      ...prev,
      {
        accreditationId: addAccredId,
        accreditationName: accred?.name || "",
        accreditationNumber: accred?.accreditationNumber || "",
        expires: accred?.expires ?? false,
        renewalMonths: accred?.renewalMonths ?? null,
        recordId: created.id,
        status: addStatus,
        required: addRequired,
        expiryDate: addExpiry || "",
        certificateNumber: addCert || "",
        notes: "",
        dirty: false,
        // If currently linked via role/skill, it'll fall under that skill on next render;
        // otherwise standalone. Checking here avoids re-deriving linkedMap.
        standalone: !employee.trainingRoles.some((tr) =>
          tr.role.skillLinks.some((sl) =>
            sl.skill.accreditationLinks.some((al) => al.accreditation.id === addAccredId),
          ),
        ),
      },
    ]);
    resetAddForm();
  }

  async function handleSaveAll() {
    const dirtyRows = rows.filter((r) => r.dirty);
    if (dirtyRows.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      for (const row of dirtyRows) {
        if (row.recordId) {
          const res = await fetch(`/api/training/employees/${employee.id}/accreditations/${row.recordId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: row.status,
              // Only send `required` for standalone rows — linked rows take
              // their Required/Other classification from the skill link.
              ...(row.standalone && { required: row.required }),
              expiryDate: row.expiryDate || null,
              certificateNumber: row.certificateNumber || null,
              notes: row.notes || null,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Failed to update ${row.accreditationName}`);
          }
        } else {
          const res = await fetch(`/api/training/employees/${employee.id}/accreditations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accreditationId: row.accreditationId,
              status: row.status === "MISSING" ? "PENDING" : row.status,
              ...(row.standalone && { required: row.required }),
              expiryDate: row.expiryDate || null,
              certificateNumber: row.certificateNumber || null,
              notes: row.notes || null,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Failed to create ${row.accreditationName}`);
          }
        }
      }

      setSuccessMsg(`Saved ${dirtyRows.length} change${dirtyRows.length > 1 ? "s" : ""}.`);
      setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
      setTimeout(() => onClose(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const { pct, compliant, total, expiredCount, expiringSoonCount } = computeCompliance(employee);
  const dirtyCount = rows.filter((r) => r.dirty).length;

  // Build skill-based grouping. Each row is placed under the first skill that
  // links it (based on role order), or into the "Standalone" group if the
  // employee has it but no current role/skill references it.
  interface SkillRef { id: string; skillNumber: string; name: string }
  const STANDALONE_ID = "_standalone";
  interface RowWithIdx { row: AccredEditRow; idx: number }
  interface SkillGroup { skill: SkillRef; required: RowWithIdx[]; other: RowWithIdx[] }
  const groupedRows = useMemo(() => {
    const accredToSkill = new Map<string, SkillRef>();
    const skillOrder: SkillRef[] = [];
    employee.trainingRoles.forEach((tr) => {
      tr.role.skillLinks.forEach((sl) => {
        if (!skillOrder.some((s) => s.id === sl.skill.id)) {
          skillOrder.push({ id: sl.skill.id, skillNumber: sl.skill.skillNumber, name: sl.skill.name });
        }
        sl.skill.accreditationLinks.forEach((al) => {
          if (!accredToSkill.has(al.accreditation.id)) {
            accredToSkill.set(al.accreditation.id, { id: sl.skill.id, skillNumber: sl.skill.skillNumber, name: sl.skill.name });
          }
        });
      });
    });

    const q = modalSearch.trim().toLowerCase();
    const visibleIdx = rows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => {
        if (!q) return true;
        const skill = accredToSkill.get(row.accreditationId);
        return (
          row.accreditationName.toLowerCase().includes(q) ||
          row.accreditationNumber.toLowerCase().includes(q) ||
          (skill ? skill.name.toLowerCase().includes(q) : false)
        );
      });

    const bySkill = new Map<string, SkillGroup>();
    visibleIdx.forEach(({ row, idx }) => {
      const skill = row.standalone
        ? { id: STANDALONE_ID, skillNumber: "", name: "Standalone" }
        : accredToSkill.get(row.accreditationId)
          || { id: STANDALONE_ID, skillNumber: "", name: "Standalone" };
      if (!bySkill.has(skill.id)) bySkill.set(skill.id, { skill, required: [], other: [] });
      const group = bySkill.get(skill.id)!;
      (row.required ? group.required : group.other).push({ row, idx });
    });

    const groups: SkillGroup[] = [];
    skillOrder.forEach((s) => {
      const g = bySkill.get(s.id);
      if (g) groups.push(g);
    });
    const standalone = bySkill.get(STANDALONE_ID);
    if (standalone) groups.push(standalone);
    return groups;
  }, [rows, modalSearch, employee]);

  const visibleCount = groupedRows.reduce((n, g) => n + g.required.length + g.other.length, 0);

  return (
    <Modal isOpen onClose={onClose}>
      <div className="max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-gray-400 font-mono">{employee.employeeNumber}</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <span className="text-xs font-medium text-red-600">{expiredCount} expired</span>
            )}
            {expiringSoonCount > 0 && (
              <span className="text-xs font-medium text-amber-600">{expiringSoonCount} expiring</span>
            )}
            <span className={`text-sm font-semibold tabular-nums px-2.5 py-1 rounded-md ${
              pct === 100 ? "bg-green-50 text-green-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
            }`}>
              {compliant}/{total}
            </span>
          </div>
        </div>

        {employee.trainingRoles.length > 0 && (
          <div className="text-xs text-gray-500 mb-3">
            {employee.trainingRoles.map((tr) => tr.role.name).join(", ")}
          </div>
        )}

        {/* Modal search filter + add accreditation */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {rows.length > 0 && (
            <input
              type="search"
              placeholder="Filter accreditations or skills..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
          {modalSearch && (
            <span className="text-xs text-gray-500 shrink-0">
              {visibleCount} of {rows.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {addOpen ? "Cancel" : "+ Add Accreditation"}
          </button>
        </div>

        {/* Inline add form */}
        {addOpen && (() => {
          const held = new Set(rows.map((r) => r.accreditationId));
          const q = addQuery.trim().toLowerCase();
          const available = allAccreds
            .filter((a) => !a.isArchived && !held.has(a.id))
            .filter((a) => !q || a.name.toLowerCase().includes(q) || a.accreditationNumber.toLowerCase().includes(q));
          const selected = allAccreds.find((a) => a.id === addAccredId);
          return (
            <div className="mb-3 p-3 border border-blue-200 bg-blue-50/30 rounded-lg space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Add accreditation to {employee.firstName}</div>
              <input
                type="search"
                placeholder="Search accreditations..."
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={addAccredId}
                onChange={(e) => setAddAccredId(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Select an accreditation...</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>{a.accreditationNumber} — {a.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Status</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as "VERIFIED" | "EXPIRED")}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="VERIFIED">Verified</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Category</label>
                  <div className="pt-1"><RequiredOtherPill required={addRequired} onChange={setAddRequired} /></div>
                </div>
                {selected?.expires && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Expiry</label>
                    <input
                      type="date"
                      value={addExpiry}
                      onChange={(e) => setAddExpiry(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Certificate #</label>
                  <input
                    type="text"
                    value={addCert}
                    onChange={(e) => setAddCert(e.target.value)}
                    placeholder="—"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={resetAddForm} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  type="button"
                  onClick={handleAddAccreditation}
                  disabled={!addAccredId}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })()}

        {/* Accreditation rows (grouped by skill) */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
          {rows.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No accreditations required for assigned roles.</p>
          )}
          {rows.length > 0 && visibleCount === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No accreditations match this filter.</p>
          )}
          {groupedRows.map((group) => (
            <div key={group.skill.id}>
              <div className="flex items-baseline gap-2 mb-1.5 px-0.5">
                {group.skill.skillNumber && (
                  <span className="text-[11px] font-mono text-gray-400">{group.skill.skillNumber}</span>
                )}
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{group.skill.name}</h3>
                <span className="text-[11px] text-gray-400">· {group.required.length + group.other.length}</span>
              </div>
              {[
                { label: "Required", items: group.required },
                { label: "Other", items: group.other },
              ].filter((sub) => sub.items.length > 0).map((sub) => (
                <div key={sub.label} className="mb-3">
                  {(group.required.length > 0 && group.other.length > 0) && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 pl-0.5">
                      {sub.label}
                    </div>
                  )}
                  <div className="space-y-3">
                    {sub.items.map(({ row, idx }) => {
            const dateExpired = row.expires && isDateExpired(row.expiryDate || null);
            const dateExpiringSoon = row.expires && isDateExpiringSoon(row.expiryDate || null);
            const showExpiryWarning = row.status === "VERIFIED" && dateExpired;
            const showExpiringSoonWarning = row.status === "VERIFIED" && dateExpiringSoon;

            return (
              <div
                key={row.accreditationId}
                className={`border rounded-lg p-3 space-y-2 ${
                  row.dirty ? "border-blue-300 bg-blue-50/30" :
                  showExpiryWarning ? "border-red-200 bg-red-50/30" :
                  showExpiringSoonWarning ? "border-amber-200 bg-amber-50/30" :
                  "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-mono text-gray-400 mr-2">{row.accreditationNumber}</span>
                    <span className="text-sm font-medium text-gray-900">{row.accreditationName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.standalone ? (
                      <RequiredOtherPill
                        required={row.required}
                        onChange={(r) => updateRow(idx, "required", r)}
                      />
                    ) : (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${
                          row.required ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}
                        title="Set at the skill level"
                      >
                        {row.required ? "Required" : "Other"}
                      </span>
                    )}
                    {row.expires && row.renewalMonths && (
                      <span className="text-xs text-gray-400">
                        {row.renewalMonths}mo renewal
                      </span>
                    )}
                    {row.standalone && row.recordId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStandalone(row.recordId!)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                        title="Remove this standalone accreditation"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {showExpiryWarning && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1">
                    Expired {row.expiryDate} — not compliant until renewed.
                  </div>
                )}
                {showExpiringSoonWarning && row.expiryDate && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    Expires in {daysUntil(row.expiryDate)} days ({row.expiryDate}).
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Status</label>
                    <select
                      value={row.status === "MISSING" ? "" : row.status}
                      onChange={(e) => updateRow(idx, "status", e.target.value)}
                      className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        row.status === "VERIFIED" && !dateExpired ? "border-green-300 bg-green-50" :
                        row.status === "EXPIRED" || dateExpired ? "border-red-300 bg-red-50" :
                        row.status === "EXEMPT" ? "border-blue-300 bg-blue-50" :
                        row.status === "MISSING" ? "border-gray-300 bg-gray-50" :
                        "border-yellow-300 bg-yellow-50"
                      }`}
                    >
                      {row.status === "MISSING" && <option value="">Missing</option>}
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{ACCREDITATION_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>

                  {row.expires && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Expiry Date</label>
                      <input
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) => updateRow(idx, "expiryDate", e.target.value)}
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          dateExpired ? "border-red-300 bg-red-50 text-red-700" :
                          dateExpiringSoon ? "border-amber-300 bg-amber-50 text-amber-700" :
                          "border-gray-300"
                        }`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Certificate #</label>
                    <input
                      type="text"
                      value={row.certificateNumber}
                      onChange={(e) => updateRow(idx, "certificateNumber", e.target.value)}
                      placeholder="—"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(idx, "notes", e.target.value)}
                      placeholder="—"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            );
                  })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-3 border-t border-gray-200">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          {successMsg && <p className="text-green-600 text-sm mb-2">{successMsg}</p>}
          <div className="flex items-center justify-between">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || dirtyCount === 0}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : dirtyCount > 0 ? `Save ${dirtyCount} Change${dirtyCount > 1 ? "s" : ""}` : "No Changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
