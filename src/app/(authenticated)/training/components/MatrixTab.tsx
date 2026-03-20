"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/shared/components/Modal";
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
  expiryDate: string | null;
  certificateNumber: string | null;
  notes: string | null;
}

interface EmployeeRole {
  role: {
    id: string;
    roleNumber: string;
    name: string;
    skillLinks: { skill: { id: string; name: string; accreditationLinks: { accreditation: AccredDef }[] } }[];
  };
}

interface EmployeeRow {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  trainingRoles: EmployeeRole[];
  accreditations: EmployeeAccred[];
}

type View = "tree" | "employees";

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
  expiryDate: string;
  certificateNumber: string;
  notes: string;
  dirty: boolean;
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

/**
 * Determine the effective compliance status for a held accreditation.
 * VERIFIED but with a past expiryDate → effectively expired (not compliant).
 * EXEMPT → always compliant regardless of dates.
 */
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

// ─── Compliance computation ────────────────────────────
function computeCompliance(emp: EmployeeRow) {
  const requiredAccredIds = new Set<string>();
  emp.trainingRoles.forEach((tr) => {
    tr.role.skillLinks.forEach((sl) => {
      sl.skill.accreditationLinks.forEach((al) => {
        requiredAccredIds.add(al.accreditation.id);
      });
    });
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

  const pct = total > 0 ? Math.round((compliant / total) * 100) : 100;
  return { requiredAccredIds, heldMap, pct, total, compliant, expiredCount, expiringSoonCount };
}

const formatDate = (d: string | null) => (d ? d.split("T")[0] : "");

// ═══════════════════════════════════════════════════════
export function MatrixTab() {
  const [view, setView] = useState<View>("tree");
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);

  const loadData = useCallback((v: View) => {
    setLoading(true);
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

  function handleEmployeeClick(emp: EmployeeRow) {
    setSelectedEmployee(emp);
  }

  function handleModalClose() {
    setSelectedEmployee(null);
    if (view === "employees") loadData("employees");
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setView("tree")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === "tree" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Role / Skill / Accreditation Tree
        </button>
        <button
          onClick={() => setView("employees")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === "employees" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Employee Compliance
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : view === "tree" ? (
        <TreeView data={treeData} />
      ) : (
        <EmployeeComplianceView employees={employees} onEmployeeClick={handleEmployeeClick} />
      )}

      {selectedEmployee && (
        <ComplianceModal employee={selectedEmployee} onClose={handleModalClose} />
      )}
    </>
  );
}

// ─── Tree View ─────────────────────────────────────────
function TreeView({ data }: { data: TreeData | null }) {
  if (!data) return null;

  const hasContent = data.roles.length > 0 || data.unlinkedSkills.length > 0 || data.unlinkedAccreditations.length > 0;
  if (!hasContent) {
    return <div className="text-center py-12 text-gray-500">No training data configured yet. Start by creating roles, skills, and accreditations.</div>;
  }

  return (
    <div className="space-y-4">
      {data.roles.map((role) => (
        <div key={role.id} className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-400">{role.roleNumber}</span>
            <h3 className="font-semibold text-gray-900">{role.name}</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{role.category === "OFFICE" ? "Office" : "Field"}</span>
          </div>
          {role.skillLinks.length === 0 ? (
            <p className="text-sm text-gray-400 ml-4">No skills linked</p>
          ) : (
            <div className="ml-4 space-y-2">
              {role.skillLinks.map((sl) => (
                <div key={sl.skill.id} className="border-l-2 border-blue-200 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{sl.skill.skillNumber}</span>
                    <span className="text-sm font-medium">{sl.skill.name}</span>
                  </div>
                  {sl.skill.accreditationLinks.length > 0 && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {sl.skill.accreditationLinks.map((al) => (
                        <div key={al.accreditation.id} className="flex items-center gap-2 text-xs text-gray-600">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Unlinked Skills</h3>
          <ul className="space-y-1">
            {data.unlinkedSkills.map((s) => (
              <li key={s.id} className="text-sm text-yellow-700">{s.skillNumber} — {s.name}</li>
            ))}
          </ul>
        </div>
      )}

      {data.unlinkedAccreditations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Unlinked Accreditations</h3>
          <ul className="space-y-1">
            {data.unlinkedAccreditations.map((a) => (
              <li key={a.id} className="text-sm text-yellow-700">{a.accreditationNumber} — {a.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Employee Compliance View ──────────────────────────
function EmployeeComplianceView({ employees, onEmployeeClick }: { employees: EmployeeRow[]; onEmployeeClick: (emp: EmployeeRow) => void }) {
  if (employees.length === 0) {
    return <div className="text-center py-12 text-gray-500">No active employees found.</div>;
  }

  return (
    <div className="space-y-3">
      {employees.map((emp) => {
        const { requiredAccredIds, heldMap, pct, expiredCount, expiringSoonCount } = computeCompliance(emp);
        const barColor = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

        return (
          <div
            key={emp.id}
            className="bg-white border rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            onClick={() => onEmployeeClick(emp)}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-mono text-gray-400">{emp.employeeNumber}</span>
                <span className="ml-2 font-medium">{emp.firstName} {emp.lastName}</span>
              </div>
              <div className="flex items-center gap-2">
                {expiredCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">
                    {expiredCount} expired
                  </span>
                )}
                {expiringSoonCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                    {expiringSoonCount} expiring soon
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${pct === 100 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {pct}% compliant
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
              <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>

            {/* Roles */}
            {emp.trainingRoles.length > 0 && (
              <div className="text-xs text-gray-500 mb-1">
                Roles: {emp.trainingRoles.map((tr) => tr.role.name).join(", ")}
              </div>
            )}

            {/* Required accreditations status */}
            {requiredAccredIds.size > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Array.from(requiredAccredIds).map((accredId) => {
                  const held = heldMap.get(accredId);
                  const accredDef = held?.accreditation || emp.trainingRoles
                    .flatMap((tr) => tr.role.skillLinks)
                    .flatMap((sl) => sl.skill.accreditationLinks)
                    .map((al) => al.accreditation)
                    .find((a) => a.id === accredId);
                  const label = accredDef?.name || accredId;

                  // Use effective status (date-aware)
                  const effectiveStatus = held ? getEffectiveStatus(held) : "MISSING";
                  const displayLabel = effectiveStatus === "EXPIRY_PASSED"
                    ? "Expired (date)"
                    : (ACCREDITATION_STATUS_LABELS[effectiveStatus] || effectiveStatus);

                  return (
                    <span key={accredId} className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[effectiveStatus] || STATUS_COLORS.MISSING}`}>
                      {label}: {displayLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Compliance Edit Modal ─────────────────────────────
function ComplianceModal({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const [rows, setRows] = useState<AccredEditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const heldMap = new Map(employee.accreditations.map((ea) => [ea.accreditation.id, ea]));

    const accredMap = new Map<string, AccredDef>();
    employee.trainingRoles.forEach((tr) => {
      tr.role.skillLinks.forEach((sl) => {
        sl.skill.accreditationLinks.forEach((al) => {
          accredMap.set(al.accreditation.id, al.accreditation);
        });
      });
    });

    const editRows: AccredEditRow[] = [];
    accredMap.forEach((def, accredId) => {
      const held = heldMap.get(accredId);
      editRows.push({
        accreditationId: accredId,
        accreditationName: def.name,
        accreditationNumber: def.accreditationNumber,
        expires: def.expires,
        renewalMonths: def.renewalMonths,
        recordId: held?.id || null,
        status: held?.status || "MISSING",
        expiryDate: formatDate(held?.expiryDate || null),
        certificateNumber: held?.certificateNumber || "",
        notes: held?.notes || "",
        dirty: false,
      });
    });

    // Sort: non-compliant first (including date-expired), then alphabetical
    editRows.sort((a, b) => {
      const aOk = (a.status === "VERIFIED" && !isDateExpired(a.expiryDate)) || a.status === "EXEMPT" ? 1 : 0;
      const bOk = (b.status === "VERIFIED" && !isDateExpired(b.expiryDate)) || b.status === "EXEMPT" ? 1 : 0;
      if (aOk !== bOk) return aOk - bOk;
      return a.accreditationName.localeCompare(b.accreditationName);
    });

    setRows(editRows);
  }, [employee]);

  function updateRow(idx: number, field: keyof AccredEditRow, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value, dirty: true } : r))
    );
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

  return (
    <Modal isOpen onClose={onClose}>
      <div className="max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs text-gray-500">{employee.employeeNumber}</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">
                {expiredCount} expired
              </span>
            )}
            {expiringSoonCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                {expiringSoonCount} soon
              </span>
            )}
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${pct === 100 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
              {compliant}/{total} — {pct}%
            </span>
          </div>
        </div>

        {employee.trainingRoles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {employee.trainingRoles.map((tr) => (
              <span key={tr.role.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {tr.role.name}
              </span>
            ))}
          </div>
        )}

        {/* Accreditation rows */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">No accreditations required for assigned roles.</p>
          )}
          {rows.map((row, idx) => {
            const dateExpired = row.expires && isDateExpired(row.expiryDate || null);
            const dateExpiringSoon = row.expires && isDateExpiringSoon(row.expiryDate || null);
            const showExpiryWarning = row.status === "VERIFIED" && dateExpired;
            const showExpiringSoonWarning = row.status === "VERIFIED" && dateExpiringSoon;

            return (
              <div
                key={row.accreditationId}
                className={`border rounded-lg p-3 space-y-2 ${
                  row.dirty ? "border-blue-300 bg-blue-50/30" :
                  showExpiryWarning ? "border-red-300 bg-red-50/30" :
                  showExpiringSoonWarning ? "border-amber-300 bg-amber-50/30" :
                  "border-gray-200"
                }`}
              >
                {/* Accreditation header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{row.accreditationNumber}</span>
                    <span className="text-sm font-medium text-gray-900">{row.accreditationName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.expires && row.renewalMonths && (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                        Typical: {row.renewalMonths}mo renewal
                      </span>
                    )}
                  </div>
                </div>

                {/* Expiry warnings */}
                {showExpiryWarning && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    Expired on {row.expiryDate} — status shows Verified but expiry date has passed. Not compliant until renewed.
                  </div>
                )}
                {showExpiringSoonWarning && row.expiryDate && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Expires in {daysUntil(row.expiryDate)} days ({row.expiryDate}). Plan renewal soon.
                  </div>
                )}

                {/* Editable fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {/* Status */}
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

                  {/* Expiry Date — only if accreditation expires */}
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

                  {/* Certificate Number */}
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

                  {/* Notes */}
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

        {/* Footer */}
        <div className="pt-4 mt-3 border-t">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          {successMsg && <p className="text-green-600 text-sm mb-2">{successMsg}</p>}
          <div className="flex items-center justify-between">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
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
