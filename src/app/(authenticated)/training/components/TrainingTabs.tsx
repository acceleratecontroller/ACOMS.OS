"use client";

export type TrainingTab = "roles" | "skills" | "accreditations" | "matrix";

interface TrainingTabsProps {
  active: TrainingTab;
  onChange: (tab: TrainingTab) => void;
}

const tabs: { key: TrainingTab; label: string }[] = [
  { key: "matrix", label: "Matrix" },
  { key: "roles", label: "Roles" },
  { key: "skills", label: "Skills" },
  { key: "accreditations", label: "Accreditations" },
];

export function TrainingTabs({ active, onChange }: TrainingTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              active === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
