"use client";

import { useEffect, useState } from "react";
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
interface EmployeeAccred {
  accreditation: { id: string; accreditationNumber: string; name: string };
  status: string;
  expiryDate: string | null;
}

interface EmployeeRole {
  role: {
    id: string;
    roleNumber: string;
    name: string;
    skillLinks: { skill: { id: string; name: string; accreditationLinks: { accreditationId: string }[] } }[];
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

export function MatrixTab() {
  const [view, setView] = useState<View>("tree");
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (view === "tree") {
      fetch("/api/training/matrix?view=tree")
        .then((r) => r.json())
        .then((d) => { setTreeData(d); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      fetch("/api/training/matrix?view=employees")
        .then((r) => r.json())
        .then((d) => { setEmployees(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [view]);

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
        <EmployeeComplianceView employees={employees} />
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
function EmployeeComplianceView({ employees }: { employees: EmployeeRow[] }) {
  if (employees.length === 0) {
    return <div className="text-center py-12 text-gray-500">No active employees found.</div>;
  }

  return (
    <div className="space-y-3">
      {employees.map((emp) => {
        // Calculate required accreditation IDs from assigned roles
        const requiredAccredIds = new Set<string>();
        emp.trainingRoles.forEach((tr) => {
          tr.role.skillLinks.forEach((sl) => {
            sl.skill.accreditationLinks.forEach((al) => {
              requiredAccredIds.add(al.accreditationId);
            });
          });
        });

        const heldAccredMap = new Map(
          emp.accreditations.map((ea) => [ea.accreditation.id, ea]),
        );

        const totalRequired = requiredAccredIds.size;
        let compliant = 0;
        requiredAccredIds.forEach((id) => {
          const held = heldAccredMap.get(id);
          if (held && held.status === "VERIFIED") compliant++;
        });

        const pct = totalRequired > 0 ? Math.round((compliant / totalRequired) * 100) : 100;
        const barColor = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

        return (
          <div key={emp.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-mono text-gray-400">{emp.employeeNumber}</span>
                <span className="ml-2 font-medium">{emp.firstName} {emp.lastName}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${pct === 100 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                {pct}% compliant
              </span>
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
            {totalRequired > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Array.from(requiredAccredIds).map((accredId) => {
                  const held = heldAccredMap.get(accredId);
                  const accredInfo = held?.accreditation || emp.trainingRoles
                    .flatMap((tr) => tr.role.skillLinks)
                    .flatMap((sl) => sl.skill.accreditationLinks)
                    .find((al) => al.accreditationId === accredId);
                  const label = held ? held.accreditation.name : accredId;
                  const status = held ? held.status : "MISSING";
                  const statusColors: Record<string, string> = {
                    VERIFIED: "bg-green-100 text-green-700",
                    PENDING: "bg-yellow-100 text-yellow-700",
                    EXPIRED: "bg-red-100 text-red-700",
                    EXEMPT: "bg-blue-100 text-blue-700",
                    MISSING: "bg-gray-100 text-gray-500",
                  };
                  return (
                    <span key={accredId} className={`text-xs px-2 py-0.5 rounded ${statusColors[status] || statusColors.MISSING}`}>
                      {label}: {ACCREDITATION_STATUS_LABELS[status] || status}
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
