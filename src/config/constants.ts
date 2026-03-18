/**
 * Shared constants for option lists used across the app.
 * Single source of truth — import these instead of defining inline.
 */

// ─── Generic option type ─────────────────────────────────
export interface SelectOption {
  value: string;
  label: string;
}

// ─── Employee constants ──────────────────────────────────

export const LOCATION_OPTIONS: SelectOption[] = [
  { value: "BRISBANE", label: "Brisbane" },
  { value: "BUNDABERG", label: "Bundaberg" },
  { value: "HERVEY_BAY", label: "Hervey Bay" },
  { value: "MACKAY", label: "Mackay" },
  { value: "OTHER", label: "Other" },
];

export const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_OPTIONS.map((o) => [o.value, o.label]),
);

export const ROLE_TYPE_OPTIONS: SelectOption[] = [
  { value: "OFFICE", label: "Office" },
  { value: "FIELD", label: "Field" },
];

export const EMPLOYMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "FULL_TIME", label: "Full-Time" },
  { value: "TRAINEE", label: "Trainee" },
  { value: "CASUAL", label: "Casual" },
  { value: "ABN", label: "ABN" },
];

export const EMPLOYMENT_LABELS: Record<string, string> = Object.fromEntries(
  EMPLOYMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const EMPLOYEE_STATUS_OPTIONS: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TERMINATED", label: "Terminated" },
];

export const SHIRT_SIZE_OPTIONS: SelectOption[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "2XL", label: "2XL" },
  { value: "3XL", label: "3XL" },
  { value: "4XL", label: "4XL" },
  { value: "5XL", label: "5XL" },
];

export const PANTS_SIZE_OPTIONS: SelectOption[] = [
  { value: "28", label: "28" },
  { value: "30", label: "30" },
  { value: "32", label: "32" },
  { value: "34", label: "34" },
  { value: "36", label: "36" },
  { value: "38", label: "38" },
  { value: "40", label: "40" },
  { value: "42", label: "42" },
  { value: "44", label: "44" },
];

// ─── Asset constants ─────────────────────────────────────

export const ASSET_STATUS_OPTIONS: SelectOption[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_USE", label: "In Use" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "RETIRED", label: "Retired" },
];

// ─── Plant constants ─────────────────────────────────────

export const PLANT_STATUS_OPTIONS: SelectOption[] = [
  { value: "OPERATIONAL", label: "Operational" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
  { value: "STANDBY", label: "Standby" },
];

// ─── Shared constants (used by assets and plant) ─────────

export const CONDITION_OPTIONS: SelectOption[] = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

// ─── Task constants ──────────────────────────────────────

export const TASK_STATUS_OPTIONS: SelectOption[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "STUCK", label: "Stuck" },
  { value: "AWAITING_RESPONSE", label: "Awaiting Response" },
  { value: "COMPLETED", label: "Completed" },
];

export const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

export const FREQUENCY_OPTIONS: SelectOption[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

export const SCHEDULE_OPTIONS: SelectOption[] = [
  { value: "FLOATING", label: "Floating (from completion date)" },
  { value: "FIXED", label: "Fixed (anchored schedule)" },
];

export const RECURRING_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Task", label: "Task" },
  { value: "Meeting", label: "Meeting" },
  { value: "Report", label: "Report" },
  { value: "Inspection", label: "Inspection" },
  { value: "Maintenance", label: "Maintenance" },
];
