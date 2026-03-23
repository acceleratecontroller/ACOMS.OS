"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  TASK_STATUS_OPTIONS as STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FREQUENCY_OPTIONS,
  SCHEDULE_OPTIONS,
  RECURRING_CATEGORY_OPTIONS,
} from "@/modules/tasks/constants";
import {
  Employee,
  Task,
  RecurringTask,
  isOverdue,
  isDueToday,
  isDueSoon,
  formatDateISO,
  getDateGroupLabel,
  tomorrowISO,
  ownerName,
} from "./types";
import { TaskRow } from "./TaskRow";
import { RecurringTaskRow } from "./RecurringTaskRow";
import { RecurringCalendar } from "./RecurringCalendar";

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
      // Fetch session and all data in parallel instead of sequentially
      const [sessionRes] = await Promise.all([
        fetch("/api/auth/session").catch(() => null),
        loadEmployees(),
        loadTasks(showArchived),
        loadRecurringTasks(showArchived),
      ]);
      if (sessionRes?.ok) {
        const sess = await sessionRes.json();
        setIsAdmin(sess?.user?.role === "ADMIN");
      }
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
        case "due-today":
          match = t.status !== "COMPLETED" && isDueToday(t.dueDate);
          break;
        case "due-soon":
          match = t.status !== "COMPLETED" && isDueSoon(t.dueDate) && !isDueToday(t.dueDate);
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
        case "due-today":
          match = isDueToday(t.nextDue);
          break;
        case "due-soon":
          match = isDueSoon(t.nextDue) && !isDueToday(t.nextDue);
          break;
        case "on-track":
          match = !isOverdue(t.nextDue) && !isDueToday(t.nextDue) && !isDueSoon(t.nextDue);
          break;
      }
      if (recurringOwnerFilter && t.ownerId !== recurringOwnerFilter) match = false;
      return match;
    });
  }, [recurringTasks, recurringFilter, recurringOwnerFilter]);

  // Group tasks by due date
  const groupedTasks = useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => {
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
              { key: "overdue", label: "Overdue" },
              { key: "due-today", label: "Due Today" },
              { key: "due-soon", label: "Due Soon" },
              { key: "pending", label: "Pending" },
              { key: "completed", label: "Completed" },
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
              { key: "due-today", label: "Due Today" },
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
          {recurringView === "calendar" && <RecurringCalendar tasks={recurringTasks} />}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Progress</label>
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
                  {RECURRING_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
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
                  {RECURRING_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
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
