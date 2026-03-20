"use client";

import { Suspense, useState, useEffect } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { TrainingTabs, TrainingTab } from "./components/TrainingTabs";
import { RolesTab } from "./components/RolesTab";
import { SkillsTab } from "./components/SkillsTab";
import { AccreditationsTab } from "./components/AccreditationsTab";
import { MatrixTab } from "./components/MatrixTab";

export default function TrainingPage() {
  return (
    <Suspense>
      <TrainingContent />
    </Suspense>
  );
}

interface ComplianceSummary {
  expired: number;
  expiringSoon: number;
  pending: number;
  missing: number;
}

function TrainingContent() {
  const [activeTab, setActiveTab] = useState<TrainingTab>("matrix");
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);

  useEffect(() => {
    fetch("/api/training/compliance-summary")
      .then((r) => r.json())
      .then((data) => setCompliance(data))
      .catch(() => {});
  }, []);

  const hasAlerts = compliance && (compliance.expired > 0 || compliance.expiringSoon > 0 || compliance.pending > 0 || compliance.missing > 0);
  const totalIssues = compliance ? compliance.expired + compliance.pending + compliance.missing : 0;

  return (
    <div>
      <PageHeader
        title="Training"
        description="Manage roles, skills, accreditations, and employee compliance."
      />

      {/* Compliance alert banner */}
      {hasAlerts && (
        <div className="mb-4 space-y-3">
          {totalIssues > 0 && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
              {totalIssues} accreditation issue{totalIssues !== 1 ? "s" : ""} to resolve
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {compliance.expired > 0 && (
              <button
                onClick={() => setActiveTab("matrix")}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                {compliance.expired} expired
              </button>
            )}
            {compliance.expiringSoon > 0 && (
              <button
                onClick={() => setActiveTab("matrix")}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                {compliance.expiringSoon} expiring soon
              </button>
            )}
            {(compliance.missing > 0 || compliance.pending > 0) && (
              <button
                onClick={() => setActiveTab("matrix")}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 hover:bg-yellow-100 transition-colors"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                {compliance.missing + compliance.pending} missing or pending
              </button>
            )}
          </div>
        </div>
      )}

      <TrainingTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "roles" && <RolesTab />}
      {activeTab === "skills" && <SkillsTab />}
      {activeTab === "accreditations" && <AccreditationsTab />}
      {activeTab === "matrix" && <MatrixTab />}
    </div>
  );
}
