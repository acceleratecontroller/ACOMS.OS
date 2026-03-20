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

  const hasAlerts = compliance && (compliance.expired > 0 || compliance.expiringSoon > 0);

  return (
    <div>
      <PageHeader
        title="Training"
        description="Manage roles, skills, accreditations, and employee compliance."
      />

      {/* Compliance alert banner */}
      {hasAlerts && (
        <div className="mb-4 flex flex-wrap gap-3">
          {compliance.expired > 0 && (
            <button
              onClick={() => setActiveTab("matrix")}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {compliance.expired} employee{compliance.expired !== 1 ? "s" : ""} with expired accreditations
            </button>
          )}
          {compliance.expiringSoon > 0 && (
            <button
              onClick={() => setActiveTab("matrix")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              {compliance.expiringSoon} employee{compliance.expiringSoon !== 1 ? "s" : ""} with accreditations expiring within 30 days
            </button>
          )}
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
