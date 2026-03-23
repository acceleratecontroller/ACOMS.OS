/**
 * Task-specific constants — single source of truth.
 * Extracted from src/config/constants.ts for clean module boundaries.
 * These will move with the To-Do module to the shared-tools repo.
 */

export interface SelectOption {
  value: string;
  label: string;
}

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
  { value: "DAILY", label: "Daily (Mon–Fri)" },
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
