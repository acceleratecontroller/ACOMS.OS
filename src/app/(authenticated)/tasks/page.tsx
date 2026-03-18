"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

// ─── Types ────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface Task {
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

interface RecurringTask {
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

// ─── Constants ────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "STUCK", label: "Stuck" },
  { value: "AWAITING_RESPONSE", label: "Awaiting Response" },
  { value: "COMPLETED", label: "Completed" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

const SCHEDULE_OPTIONS = [
  { value: "FLOATING", label: "Floating (from completion date)" },
  { value: "FIXED", label: "Fixed (anchored schedule)" },
];

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  STUCK: "bg-red-100 text-red-700",
  AWAITING_RESPONSE: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "border-l-green-500",
  MEDIUM: "border-l-yellow-500",
  HIGH: "border-l-red-500",
};

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

// ─── Helpers ──────────────────────────────────────────────

function formatStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDateISO(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  return d >= today && d <= week;
}

function getDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateISO(d.toISOString());
}

function ownerName(emp: Employee): string {
  return `${emp.firstName} ${emp.lastName}`;
}

function frequencyLabel(type: string, value: number): string {
  const typeLabel = FREQUENCY_OPTIONS.find((o) => o.value === type)?.label ?? type;
  if (value === 1) return typeLabel;
  return `Every ${value} ${typeLabel.toLowerCase()}`;
}

// ─── Main Page Component ─────────────────────────────────

export default function TaskManagerPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // State
  const [activeTab, setActiveTab] = useState<"quick" | "recurring">("quick");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");

  // Quick Tasks state
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskOwnerFilter, setTaskOwnerFilter] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  // Recurring Tasks state
  const [recurringFilter, setRecurringFilter] = useState("all");
  const [recurringOwnerFilter, setRecurringOwnerFilter] = useState("");
  const [recurringView, setRecurringView] = useState<"list" | "calendar">("list");
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "restore" | "complete";
    id: string;
    entity: "task" | "recurring";
    title: string;
  } | null>(null);

  // ─── Data Loading ──────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(
        data.map((e: Employee & { id: string; firstName: string; lastName: string; employeeNumber: string }) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          employeeNumber: e.employeeNumber,
        })),
      );
    }
  }, []);

  const loadTasks = useCallback(
    async (archived = false) => {
      const url = archived ? "/api/tasks?archived=true" : "/api/tasks";
      const res = await fetch(url);
      if (res.ok) setTasks(await res.json());
    },
    [],
  );

  const loadRecurringTasks = useCallback(
    async (archived = false) => {
      const url = archived ? "/api/recurring-tasks?archived=true" : "/api/recurring-tasks";
      const res = await fetch(url);
      if (res.ok) setRecurringTasks(await res.json());
    },
    [],
  );

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sess = await sessionRes.json();
          setIsAdmin(sess?.user?.role === "ADMIN");
        }
      } catch { /* ignore */ }
      await Promise.all([loadEmployees(), loadTasks(showArchived), loadRecurringTasks(showArchived)]);
      setLoading(false);
    }
    init();
  }, [loadEmployees, loadTasks, loadRecurringTasks, showArchived]);

  // ─── Filtering ─────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      let match = true;
      switch (taskFilter) {
        case "pending":
          match = t.status !== "COMPLETED";
          break;
        case "completed":
          match = t.status === "COMPLETED";
          break;
        case "overdue":
          match = t.status !== "COMPLETED" && isOverdue(t.dueDate);
          break;
        case "high":
          match = t.priority === "HIGH";
          break;
        default:
          match = showArchived ? true : t.status !== "COMPLETED";
      }
      if (taskOwnerFilter && t.ownerId !== taskOwnerFilter) match = false;
      return match;
    });
  }, [tasks, taskFilter, taskOwnerFilter, showArchived]);

  const filteredRecurring = useMemo(() => {
    return recurringTasks.filter((t) => {
      let match = true;
      switch (recurringFilter) {
        case "overdue":
          match = isOverdue(t.nextDue);
          break;
        case "due-soon":
          match = isDueSoon(t.nextDue) && !isOverdue(t.nextDue);
          break;
        case "on-track":
          match = !isOverdue(t.nextDue) && !isDueSoon(t.nextDue);
          break;
      }
      if (recurringOwnerFilter && t.ownerId !== recurringOwnerFilter) match = false;
      return match;
    });
  }, [recurringTasks, recurringFilter, recurringOwnerFilter]);

  // Group tasks by due date
  const groupedTasks = useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => {
      // Overdue first, then by date ascending, no-date last
      const aOverdue = a.status !== "COMPLETED" && isOverdue(a.dueDate);
      const bOverdue = b.status !== "COMPLETED" && isOverdue(b.dueDate);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const groups: { label: string; tasks: Task[] }[] = [];
    let lastKey = "";
    for (const t of sorted) {
      const key = t.dueDate ? formatDateISO(t.dueDate) : "no-date";
      if (key !== lastKey) {
        groups.push({
          label: key === "no-date" ? "No Due Date" : getDateGroupLabel(t.dueDate!),
          tasks: [],
        });
        lastKey = key;
      }
      groups[groups.length - 1].tasks.push(t);
    }
    return groups;
  }, [filteredTasks]);

  // Owner lists for dropdowns
  const taskOwners = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.ownerId))];
    return employees.filter((e) => ids.includes(e.id));
  }, [tasks, employees]);

  const recurringOwners = useMemo(() => {
    const ids = [...new Set(recurringTasks.map((t) => t.ownerId))];
    return employees.filter((e) => ids.includes(e.id));
  }, [recurringTasks, employees]);

  // ─── CRUD Actions ──────────────────────────────────────

  async function handleCreateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      const body = {
        title: fd.get("title"),
        projectId: fd.get("projectId") || null,
        notes: fd.get("notes") || null,
        label: fd.get("label") || "Task",
        dueDate: fd.get("dueDate") || null,
        status: "NOT_STARTED",
        priority: fd.get("priority") || "LOW",
        ownerId: fd.get("ownerId"),
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowAddTask(false);
        await loadTasks(showArchived);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || `Failed to create task (${res.status})`);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      const body = {
        title: fd.get("title"),
        projectId: fd.get("projectId") || null,
        notes: fd.get("notes") || null,
        label: fd.get("label") || "Task",
        dueDate: fd.get("dueDate") || null,
        status: fd.get("status"),
        priority: fd.get("priority"),
        ownerId: fd.get("ownerId"),
      };

      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditingTask(null);
        await loadTasks(showArchived);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || `Failed to update task (${res.status})`);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    if (res.ok) await loadTasks(showArchived);
  }

  async function handleArchiveTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) await loadTasks(showArchived);
  }

  async function handleRestoreTask(id: string) {
    const res = await fetch(`/api/tasks/${id}/restore`, { method: "POST" });
    if (res.ok) await loadTasks(showArchived);
  }

  async function handleCreateRecurring(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      const body = {
        title: fd.get("title"),
        description: fd.get("description") || null,
        category: fd.get("category") || "Task",
        frequencyType: fd.get("frequencyType") || "WEEKLY",
        frequencyValue: parseInt(String(fd.get("frequencyValue") || "1"), 10),
        scheduleType: fd.get("scheduleType") || "FLOATING",
        lastCompleted: fd.get("lastCompleted") || null,
        ownerId: fd.get("ownerId"),
      };

      const res = await fetch("/api/recurring-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowAddRecurring(false);
        await loadRecurringTasks(showArchived);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || `Failed to create recurring task (${res.status})`);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRecurring(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingRecurring) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData(e.currentTarget);
      const body = {
        title: fd.get("title"),
        description: fd.get("description") || null,
        category: fd.get("category") || "Task",
        frequencyType: fd.get("frequencyType") || "WEEKLY",
        frequencyValue: parseInt(String(fd.get("frequencyValue") || "1"), 10),
        scheduleType: fd.get("scheduleType") || "FLOATING",
        lastCompleted: fd.get("lastCompleted") || null,
        ownerId: fd.get("ownerId"),
      };

      const res = await fetch(`/api/recurring-tasks/${editingRecurring.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditingRecurring(null);
        await loadRecurringTasks(showArchived);
      } else {
        const err = await res.json().catch(() => null);
        setError(err?.error || `Failed to update recurring task (${res.status})`);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteRecurring(id: string) {
    const res = await fetch(`/api/recurring-tasks/${id}/complete`, { method: "POST" });
    if (res.ok) await loadRecurringTasks(showArchived);
  }

  async function handleArchiveRecurring(id: string) {
    const res = await fetch(`/api/recurring-tasks/${id}`, { method: "DELETE" });
    if (res.ok) await loadRecurringTasks(showArchived);
  }

  async function handleRestoreRecurring(id: string) {
    const res = await fetch(`/api/recurring-tasks/${id}/restore`, { method: "POST" });
    if (res.ok) await loadRecurringTasks(showArchived);
  }

  function handleConfirm() {
    if (!confirmAction) return;
    const { type, id, entity } = confirmAction;
    if (entity === "task") {
      if (type === "archive") handleArchiveTask(id);
      else if (type === "restore") handleRestoreTask(id);
    } else {
      if (type === "archive") handleArchiveRecurring(id);
      else if (type === "restore") handleRestoreRecurring(id);
      else if (type === "complete") handleCompleteRecurring(id);
    }
    setConfirmAction(null);
  }

  // ─── Calendar Helpers ─────────────────────────────────

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; tasks: RecurringTask[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const dateStr = formatDateISO(d.toISOString());
      const tasksOnDay = recurringTasks.filter(
        (t) => t.nextDue && formatDateISO(t.nextDue) === dateStr,
      );
      days.push({
        date: d,
        isCurrentMonth: d.getMonth() === month,
        isToday: d.getTime() === today.getTime(),
        tasks: tasksOnDay,
      });
    }
    return days;
  }, [calendarDate, recurringTasks]);

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <PageHeader title="Task Manager" description="Loading..." />
        <div className="text-center py-12 text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Task Manager" description="Track quick tasks and recurring schedules." />

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab("quick")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "quick"
              ? "text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          Quick Tasks
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "recurring"
              ? "text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          Recurring Tasks
        </button>
      </div>

      {/* ─── Quick Tasks Tab ──────────────────────────────── */}
      {activeTab === "quick" && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {isAdmin && (
              <button
                onClick={() => { setShowAddTask(true); setError(""); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Add Task
              </button>
            )}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                showArchived
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {showArchived ? "Showing Archived" : "Active"}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { key: "all", label: "All Tasks" },
              { key: "pending", label: "Pending" },
              { key: "completed", label: "Completed" },
              { key: "overdue", label: "Overdue" },
              { key: "high", label: "High Priority" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setTaskFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  taskFilter === f.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <select
              value={taskOwnerFilter}
              onChange={(e) => setTaskOwnerFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                taskOwnerFilter
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              <option value="">All Owners</option>
              {taskOwners.map((e) => (
                <option key={e.id} value={e.id}>
                  {ownerName(e)}
                </option>
              ))}
            </select>
          </div>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="font-medium">No tasks found</p>
              <p className="text-sm mt-1">Try adjusting your filters or add a new task.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {groupedTasks.map((group) => (
                <div key={group.label}>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider py-2 mt-3 first:mt-0">
                    {group.label} &middot; {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
                  </div>
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isAdmin={isAdmin}
                      onEdit={() => { setEditingTask(task); setError(""); }}
                      onComplete={() => handleCompleteTask(task.id)}
                      onArchive={() =>
                        setConfirmAction({ type: "archive", id: task.id, entity: "task", title: task.title })
                      }
                      onRestore={() =>
                        setConfirmAction({ type: "restore", id: task.id, entity: "task", title: task.title })
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Recurring Tasks Tab ─────────────────────────── */}
      {activeTab === "recurring" && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {isAdmin && (
              <button
                onClick={() => { setShowAddRecurring(true); setError(""); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Add Recurring Task
              </button>
            )}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setRecurringView("list")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  recurringView === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setRecurringView("calendar")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  recurringView === "calendar" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Calendar
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { key: "all", label: "All Tasks" },
              { key: "overdue", label: "Overdue" },
              { key: "due-soon", label: "Due Soon" },
              { key: "on-track", label: "On Track" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setRecurringFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  recurringFilter === f.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
            <select
              value={recurringOwnerFilter}
              onChange={(e) => setRecurringOwnerFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                recurringOwnerFilter
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              <option value="">All Owners</option>
              {recurringOwners.map((e) => (
                <option key={e.id} value={e.id}>
                  {ownerName(e)}
                </option>
              ))}
            </select>
          </div>

          {/* List View */}
          {recurringView === "list" && (
            <>
              {filteredRecurring.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="font-medium">No recurring tasks found</p>
                  <p className="text-sm mt-1">Add your first recurring task to start tracking schedules.</p>
                </div>
              ) : (
                <div className="bg-white border rounded-lg overflow-hidden">
                  {/* Desktop header */}
                  <div className="hidden md:grid md:grid-cols-8 gap-2 px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-2">Task</div>
                    <div>Owner</div>
                    <div>Frequency</div>
                    <div>Last Done</div>
                    <div>Next Due</div>
                    <div>Status</div>
                    <div className="text-right">Actions</div>
                  </div>
                  {filteredRecurring.map((task) => (
                    <RecurringTaskRow
                      key={task.id}
                      task={task}
                      isAdmin={isAdmin}
                      onEdit={() => { setEditingRecurring(task); setError(""); }}
                      onComplete={() =>
                        setConfirmAction({
                          type: "complete",
                          id: task.id,
                          entity: "recurring",
                          title: task.title,
                        })
                      }
                      onArchive={() =>
                        setConfirmAction({
                          type: "archive",
                          id: task.id,
                          entity: "recurring",
                          title: task.title,
                        })
                      }
                      onRestore={() =>
                        setConfirmAction({
                          type: "restore",
                          id: task.id,
                          entity: "recurring",
                          title: task.title,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Calendar View */}
          {recurringView === "calendar" && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() - 1);
                      setCalendarDate(d);
                    }}
                    className="text-lg px-2 py-1 rounded hover:bg-white/20 transition-colors"
                  >
                    &lsaquo;
                  </button>
                  <span className="font-semibold">
                    {calendarDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() + 1);
                      setCalendarDate(d);
                    }}
                    className="text-lg px-2 py-1 rounded hover:bg-white/20 transition-colors"
                  >
                    &rsaquo;
                  </button>
                </div>
                <button
                  onClick={() => setCalendarDate(new Date())}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Today
                </button>
              </div>
              <div className="grid grid-cols-7">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="px-2 py-2 bg-gray-50 text-center text-xs font-semibold text-gray-500 border-b">
                    {d}
                  </div>
                ))}
                {calendarDays.map((day, i) => (
                  <div
                    key={i}
                    className={`min-h-[80px] border-r border-b p-1 ${
                      !day.isCurrentMonth ? "bg-gray-50 text-gray-300" : ""
                    } ${day.isToday ? "bg-blue-50" : ""}`}
                  >
                    <div className="text-xs text-gray-500 mb-1">{day.date.getDate()}</div>
                    {day.tasks.map((t) => {
                      const overdue = isOverdue(t.nextDue);
                      const soon = isDueSoon(t.nextDue);
                      return (
                        <div
                          key={t.id}
                          title={t.title}
                          className={`text-[10px] px-1 py-0.5 mb-0.5 rounded truncate cursor-default ${
                            overdue
                              ? "bg-red-600 text-white"
                              : soon
                                ? "bg-yellow-400 text-black"
                                : "bg-green-500 text-white"
                          }`}
                        >
                          {t.title}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Add Task Modal ────────────────────────────────── */}
      {showAddTask && (
        <Modal isOpen onClose={() => setShowAddTask(false)}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Quick Task</h2>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input name="title" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What needs to be done?" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select name="ownerId" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select owner...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{ownerName(e)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                <input name="projectId" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., NBN-001" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input name="dueDate" type="date" defaultValue={tomorrowISO()} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select name="priority" defaultValue="LOW" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input name="label" defaultValue="Task" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Task, Meeting, Report" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea name="notes" rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Additional details..." />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Adding..." : "Add Task"}
              </button>
              <button type="button" onClick={() => setShowAddTask(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Edit Task Modal ───────────────────────────────── */}
      {editingTask && (
        <Modal isOpen onClose={() => setEditingTask(null)}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Task</h2>
          <form onSubmit={handleUpdateTask} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input name="title" required defaultValue={editingTask.title} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select name="ownerId" required defaultValue={editingTask.ownerId} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{ownerName(e)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                <input name="projectId" defaultValue={editingTask.projectId || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" defaultValue={editingTask.status} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select name="priority" defaultValue={editingTask.priority} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input name="dueDate" type="date" defaultValue={formatDateISO(editingTask.dueDate)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input name="label" defaultValue={editingTask.label} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea name="notes" rows={2} defaultValue={editingTask.notes || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditingTask(null)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Add Recurring Task Modal ─────────────────────── */}
      {showAddRecurring && (
        <Modal isOpen onClose={() => setShowAddRecurring(false)}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Recurring Task</h2>
          <form onSubmit={handleCreateRecurring} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input name="title" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What recurring task needs tracking?" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select name="ownerId" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select owner...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{ownerName(e)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="category" defaultValue="Task" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Task">Task</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Report">Report</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select name="frequencyType" defaultValue="WEEKLY" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                <input name="frequencyValue" type="number" min={1} defaultValue={1} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                <select name="scheduleType" defaultValue="FLOATING" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Completed</label>
              <input name="lastCompleted" type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Additional details..." />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Adding..." : "Add Recurring Task"}
              </button>
              <button type="button" onClick={() => setShowAddRecurring(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Edit Recurring Task Modal ────────────────────── */}
      {editingRecurring && (
        <Modal isOpen onClose={() => setEditingRecurring(null)}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Recurring Task</h2>
          <form onSubmit={handleUpdateRecurring} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input name="title" required defaultValue={editingRecurring.title} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select name="ownerId" required defaultValue={editingRecurring.ownerId} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{ownerName(e)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="category" defaultValue={editingRecurring.category} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Task">Task</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Report">Report</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select name="frequencyType" defaultValue={editingRecurring.frequencyType} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                <input name="frequencyValue" type="number" min={1} defaultValue={editingRecurring.frequencyValue} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                <select name="scheduleType" defaultValue={editingRecurring.scheduleType} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Completed</label>
              <input name="lastCompleted" type="date" defaultValue={formatDateISO(editingRecurring.lastCompleted)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" rows={2} defaultValue={editingRecurring.description || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditingRecurring(null)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Confirm Dialog ────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={
          confirmAction?.type === "archive"
            ? "Archive Task"
            : confirmAction?.type === "restore"
              ? "Restore Task"
              : "Mark as Completed"
        }
        message={
          confirmAction?.type === "archive"
            ? `Archive "${confirmAction.title}"? It will be moved to the archived list.`
            : confirmAction?.type === "restore"
              ? `Restore "${confirmAction?.title}" back to active tasks?`
              : `Mark "${confirmAction?.title}" as completed? This will advance the next due date.`
        }
        confirmLabel={
          confirmAction?.type === "archive" ? "Archive" : confirmAction?.type === "restore" ? "Restore" : "Complete"
        }
        confirmVariant={confirmAction?.type === "archive" ? "danger" : "success"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

// ─── Task Row Component ──────────────────────────────────

function TaskRow({
  task,
  isAdmin,
  onEdit,
  onComplete,
  onArchive,
  onRestore,
}: {
  task: Task;
  isAdmin: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const overdue = task.status !== "COMPLETED" && isOverdue(task.dueDate);
  const completed = task.status === "COMPLETED";

  return (
    <div
      className={`border rounded-lg mb-2 border-l-4 transition-all hover:shadow-sm ${
        PRIORITY_COLORS[task.priority] || "border-l-gray-300"
      } ${overdue ? "bg-red-50" : "bg-white"} ${completed ? "opacity-60" : ""} cursor-pointer`}
      onClick={onEdit}
    >
      {/* Desktop layout */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm text-gray-900 ${completed ? "line-through" : ""}`}>
              {task.title}
            </span>
            {task.projectId && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                {task.projectId}
              </span>
            )}
          </div>
          {task.notes && (
            <p className="text-xs text-gray-500 italic mt-0.5 truncate max-w-md">{task.notes}</p>
          )}
        </div>
        <div className="text-xs text-gray-600 font-medium w-24 truncate">{ownerName(task.owner)}</div>
        <div className="text-xs text-gray-500 w-16">{task.label}</div>
        <div className={`text-xs w-20 ${overdue ? "text-red-600 font-bold" : "text-gray-600"}`}>
          {formatDate(task.dueDate) || "No date"}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full w-28 text-center ${STATUS_COLORS[task.status] || ""}`}>
          {formatStatusLabel(task.status)}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full w-16 text-center ${PRIORITY_BADGE_COLORS[task.priority] || ""}`}>
          {task.priority}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={onComplete} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title={completed ? "Undo complete" : "Complete"}>
              {completed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
            {task.isArchived ? (
              <button onClick={onRestore} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title="Restore">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            ) : (
              <button onClick={onArchive} className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors" title="Archive">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile layout */}
      <div className="md:hidden p-3">
        <div className="flex items-start justify-between mb-2">
          <span className={`font-semibold text-sm text-gray-900 flex-1 ${completed ? "line-through" : ""}`}>
            {task.title}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 ${PRIORITY_BADGE_COLORS[task.priority] || ""}`}>
            {task.priority}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
          <div><span className="text-gray-400">Owner:</span> <span className="font-medium text-gray-700">{ownerName(task.owner)}</span></div>
          <div><span className="text-gray-400">Due:</span> <span className={`font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>{formatDate(task.dueDate) || "None"}</span></div>
          {task.projectId && <div><span className="text-gray-400">Project:</span> <span className="font-medium text-gray-700">{task.projectId}</span></div>}
          <div><span className="text-gray-400">Status:</span> <span className="font-medium text-gray-700">{formatStatusLabel(task.status)}</span></div>
        </div>
        {task.notes && <p className="text-xs text-gray-500 italic bg-gray-50 rounded p-2 mb-2">{task.notes}</p>}
        {isAdmin && (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={onComplete} className="text-xs text-green-600 font-medium">
              {completed ? "Undo" : "Complete"}
            </button>
            {task.isArchived ? (
              <button onClick={onRestore} className="text-xs text-green-600 font-medium">Restore</button>
            ) : (
              <button onClick={onArchive} className="text-xs text-red-500 font-medium">Archive</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recurring Task Row Component ────────────────────────

function RecurringTaskRow({
  task,
  isAdmin,
  onEdit,
  onComplete,
  onArchive,
  onRestore,
}: {
  task: RecurringTask;
  isAdmin: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const overdue = isOverdue(task.nextDue);
  const soon = isDueSoon(task.nextDue) && !overdue;

  let statusText = "On Track";
  let statusColor = "bg-green-100 text-green-700";
  if (overdue) {
    const days = Math.floor(
      (new Date().setHours(0, 0, 0, 0) - new Date(task.nextDue!).setHours(0, 0, 0, 0)) /
        (24 * 60 * 60 * 1000),
    );
    statusText = `Overdue ${days}d`;
    statusColor = "bg-red-100 text-red-700";
  } else if (soon) {
    statusText = "Due Soon";
    statusColor = "bg-yellow-100 text-yellow-700";
  }

  return (
    <div
      className={`border-b last:border-b-0 transition-all hover:bg-gray-50 ${
        overdue ? "bg-red-50 border-l-4 border-l-red-500" : soon ? "bg-yellow-50" : ""
      } cursor-pointer`}
      onClick={onEdit}
    >
      {/* Desktop */}
      <div className="hidden md:grid md:grid-cols-8 gap-2 px-4 py-3 items-center">
        <div className="col-span-2">
          <div className="font-semibold text-sm text-gray-900">{task.title}</div>
          {task.description && <p className="text-xs text-gray-500 italic truncate">{task.description}</p>}
        </div>
        <div className="text-xs text-gray-600 font-medium truncate">{ownerName(task.owner)}</div>
        <div className="text-xs text-gray-600">{frequencyLabel(task.frequencyType, task.frequencyValue)}</div>
        <div className="text-xs text-gray-600">{task.lastCompleted ? formatDate(task.lastCompleted) : "Never"}</div>
        <div className={`text-xs font-medium ${overdue ? "text-red-600 font-bold" : "text-gray-600"}`}>
          {task.nextDue ? formatDate(task.nextDue) : "Not set"}
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full text-center ${statusColor}`}>
          {statusText}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <button onClick={onComplete} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title="Mark completed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
            {task.isArchived ? (
              <button onClick={onRestore} className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors" title="Restore">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            ) : (
              <button onClick={onArchive} className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors" title="Archive">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile */}
      <div className="md:hidden p-3">
        <div className="flex items-start justify-between mb-2">
          <span className="font-semibold text-sm text-gray-900 flex-1">{task.title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 ${statusColor}`}>
            {statusText}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
          <div><span className="text-gray-400">Owner:</span> <span className="font-medium text-gray-700">{ownerName(task.owner)}</span></div>
          <div><span className="text-gray-400">Frequency:</span> <span className="font-medium text-gray-700">{frequencyLabel(task.frequencyType, task.frequencyValue)}</span></div>
          <div><span className="text-gray-400">Last Done:</span> <span className="font-medium text-gray-700">{task.lastCompleted ? formatDate(task.lastCompleted) : "Never"}</span></div>
          <div><span className="text-gray-400">Next Due:</span> <span className={`font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>{task.nextDue ? formatDate(task.nextDue) : "Not set"}</span></div>
        </div>
        {task.description && <p className="text-xs text-gray-500 italic bg-gray-50 rounded p-2 mb-2">{task.description}</p>}
        {isAdmin && (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={onComplete} className="text-xs text-green-600 font-medium">Complete</button>
            {task.isArchived ? (
              <button onClick={onRestore} className="text-xs text-green-600 font-medium">Restore</button>
            ) : (
              <button onClick={onArchive} className="text-xs text-red-500 font-medium">Archive</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
