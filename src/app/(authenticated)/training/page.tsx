"use client";

import { Suspense, useState } from "react";
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

function TrainingContent() {
  const [activeTab, setActiveTab] = useState<TrainingTab>("roles");

  return (
    <div>
      <PageHeader
        title="Training"
        description="Manage roles, skills, accreditations, and employee compliance."
      />
      <TrainingTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "roles" && <RolesTab />}
      {activeTab === "skills" && <SkillsTab />}
      {activeTab === "accreditations" && <AccreditationsTab />}
      {activeTab === "matrix" && <MatrixTab />}
    </div>
  );
}
