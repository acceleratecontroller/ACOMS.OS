import {
  TASK_STATUS_OPTIONS,
  FREQUENCY_OPTIONS,
} from "@/modules/tasks/constants";

// ─── Types ────────────────────────────────────────────────

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string | null;
  notes: string | null;
  label: string;
  dueDate: string | null;
  status: string;
  priority: string;
  ownerId: string;
  owner: Employee;
  isArchived: boolean;
  createdAt: string;
}

export interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  frequencyType: string;
  frequencyValue: number;
  scheduleType: string;
  lastCompleted: string | null;
  nextDue: string | null;
  ownerId: string;
  owner: Employee;
  isArchived: boolean;
  createdAt: string;
}

// ─── Style maps ──────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  STUCK: "bg-red-100 text-red-700",
  AWAITING_RESPONSE: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "border-l-green-500",
  MEDIUM: "border-l-yellow-500",
  HIGH: "border-l-red-500",
};

export const PRIORITY_BADGE_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────

/**
 * Parse a date string and return midnight in the user's local timezone,
 * preserving the calendar date the user sees (not the UTC date portion).
 */
function toDateOnly(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatStatusLabel(status: string): string {
  return TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = toDateOnly(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatDateISO(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = toDateOnly(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return toDateOnly(dateStr) < todayDateOnly();
}

export function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return toDateOnly(dateStr).getTime() === todayDateOnly().getTime();
}

export function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = toDateOnly(dateStr);
  const today = todayDateOnly();
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  return d > today && d <= week;
}

export function getDateGroupLabel(dateStr: string): string {
  const d = toDateOnly(dateStr);
  const today = todayDateOnly();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export function tomorrowISO(): string {
  const today = todayDateOnly();
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  return formatDateISO(d.toISOString());
}

export function ownerName(emp: Employee): string {
  return `${emp.firstName} ${emp.lastName}`;
}

export function frequencyLabel(type: string, value: number): string {
  const typeLabel = FREQUENCY_OPTIONS.find((o) => o.value === type)?.label ?? type;
  if (value === 1) return typeLabel;
  return `Every ${value} ${typeLabel.toLowerCase()}`;
}
