"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/shared/components/Modal";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  TASK_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FREQUENCY_OPTIONS,
  SCHEDULE_OPTIONS,
  RECURRING_CATEGORY_OPTIONS,
} from "@/config/constants";

// ─── Types ────────────────────────────────────────────────

export interface DashboardEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

export interface DashboardTaskItem {
  id: string;
  title: string;
  type: "task" | "recurring";
  owner: string;
  ownerId: string;
  priority?: string;
  dateLabel: string;
  status: "overdue" | "due-today" | "due-soon";
  // Extra fields for edit forms
  projectId?: string | null;
  notes?: string | null;
  label?: string;
  dueDate?: string | null;
  taskStatus?: string;
  // Recurring-specific
  description?: string | null;
  category?: string;
  frequencyType?: string;
  frequencyValue?: number;
  scheduleType?: string;
  lastCompleted?: string | null;
  nextDue?: string | null;
}

type TabKey = "overdue" | "due-today" | "this-week" | "recurring" | "all";

const STATUS_OPTIONS = TASK_STATUS_OPTIONS;

// ─── Component ────────────────────────────────────────────

export function DashboardTaskCentre({
  tasks,
  employees,
  viewAll,
}: {
  tasks: DashboardTaskItem[];
  employees: DashboardEmployee[];
  viewAll: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overdue");
  const [editingTask, setEditingTask] = useState<DashboardTaskItem | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<DashboardTaskItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Tab counts
  const counts: Record<TabKey, number> = {
    overdue: tasks.filter((t) => t.status === "overdue").length,
    "due-today": tasks.filter((t) => t.status === "due-today").length,
    "this-week": tasks.filter((t) => t.status === "due-soon").length,
    recurring: tasks.filter((t) => t.type === "recurring").length,
    all: tasks.length,
  };

  // Filtered tasks
  const filtered = activeTab === "all"
    ? tasks
    : activeTab === "recurring"
      ? tasks.filter((t) => t.type === "recurring")
      : activeTab === "this-week"
        ? tasks.filter((t) => t.status === "due-soon")
        : tasks.filter((t) => t.status === activeTab);

  // ─── Complete handler ────────────────────────────────

  const handleComplete = useCallback(async (task: DashboardTaskItem) => {
    setCompleting(task.id);
    try {
      const realId = task.id.replace(/^(r-|td-|rt-|s-|rs-)/, "");
      const url = task.type === "recurring"
        ? `/api/recurring-tasks/${realId}/complete`
        : `/api/tasks/${realId}/complete`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete");
      router.refresh();
    } catch {
      // silently fail, user can retry
    } finally {
      setCompleting(null);
      setConfirmComplete(null);
    }
  }, [router]);

  // ─── Edit task handler ───────────────────────────────

  const handleUpdateTask = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const realId = editingTask.id.replace(/^(r-|td-|rt-|s-|rs-)/, "");

    try {
      if (editingTask.type === "task") {
        const body: Record<string, unknown> = {
          title: fd.get("title"),
          ownerId: fd.get("ownerId"),
          projectId: fd.get("projectId") || null,
          status: fd.get("status"),
          priority: fd.get("priority"),
          dueDate: fd.get("dueDate") || null,
          label: fd.get("label") || "",
          notes: fd.get("notes") || null,
        };
        const res = await fetch(`/api/tasks/${realId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to save");
        }
      } else {
        const body: Record<string, unknown> = {
          title: fd.get("title"),
          ownerId: fd.get("ownerId"),
          category: fd.get("category"),
          frequencyType: fd.get("frequencyType"),
          frequencyValue: Number(fd.get("frequencyValue")) || 1,
          scheduleType: fd.get("scheduleType"),
          lastCompleted: fd.get("lastCompleted") || null,
          description: fd.get("description") || null,
        };
        const res = await fetch(`/api/recurring-tasks/${realId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to save");
        }
      }
      setEditingTask(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [editingTask, router]);

  // Tab config
  const tabs: { key: TabKey; label: string; color: string; activeColor: string }[] = [
    { key: "overdue", label: "Overdue", color: "text-red-700 border-red-200 bg-white", activeColor: "bg-red-600 text-white border-red-600" },
    { key: "due-today", label: "Due Today", color: "text-orange-700 border-orange-200 bg-white", activeColor: "bg-orange-500 text-white border-orange-500" },
    { key: "this-week", label: "This Week", color: "text-yellow-700 border-yellow-200 bg-white", activeColor: "bg-yellow-500 text-white border-yellow-500" },
    { key: "recurring", label: "Recurring", color: "text-blue-700 border-blue-200 bg-white", activeColor: "bg-blue-600 text-white border-blue-600" },
    { key: "all", label: "All", color: "text-gray-600 border-gray-200 bg-white", activeColor: "bg-gray-700 text-white border-gray-700" },
  ];

  return (
    <>
      <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {viewAll ? "All Tasks" : "My Tasks"}
          </h2>
          <Link href="/tasks" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">View all</Link>
        </div>

        {/* Tab filters */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-50 bg-gray-50/50 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border whitespace-nowrap transition-colors ${
                activeTab === tab.key ? tab.activeColor : tab.color
              }`}
            >
              {tab.label}
              <span className="font-bold tabular-nums">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* Task rows */}
        <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No tasks in this category</div>
          ) : (
            filtered.map((task) => (
              <div
                key={task.id}
                className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_100px_70px_80px_90px_70px] items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-gray-50 cursor-pointer ${
                  task.status === "overdue" ? "bg-red-50/40" : task.status === "due-today" ? "bg-orange-50/40" : ""
                }`}
                onClick={() => setEditingTask(task)}
              >
                {/* Title + type */}
                <div className="min-w-0">
                  <span className={`font-medium truncate block ${
                    task.status === "overdue" ? "text-red-700" : task.status === "due-today" ? "text-orange-700" : "text-gray-900"
                  }`}>
                    {task.title}
                  </span>
                  <span className="text-[11px] text-gray-400 md:hidden">
                    {task.type === "recurring" ? "Recurring" : "Task"} &middot; {task.owner}
                  </span>
                </div>
                {/* Type badge — desktop */}
                <span className={`hidden md:inline-block text-[10px] font-medium px-1.5 py-0.5 rounded text-center ${
                  task.type === "recurring" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                }`}>
                  {task.type === "recurring" ? "Recurring" : "Task"}
                </span>
                {/* Owner — desktop */}
                <span className="hidden md:block text-xs text-gray-500 truncate">{task.owner}</span>
                {/* Priority — desktop */}
                <span className="hidden md:block">
                  {task.priority ? <PriorityBadge priority={task.priority} /> : <span className="text-[10px] text-gray-300">&mdash;</span>}
                </span>
                {/* Date */}
                <span className={`hidden md:block text-xs tabular-nums ${
                  task.status === "overdue" ? "text-red-500 font-medium" : "text-gray-500"
                }`}>
                  {task.dateLabel}
                </span>
                {/* Status badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-center whitespace-nowrap ${
                  task.status === "overdue" ? "bg-red-100 text-red-700" :
                  task.status === "due-today" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {task.status === "overdue" ? "Overdue" : task.status === "due-today" ? "Due Today" : "Due Soon"}
                </span>
                {/* Complete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (task.type === "recurring") {
                      setConfirmComplete(task);
                    } else {
                      handleComplete(task);
                    }
                  }}
                  disabled={completing === task.id}
                  className="hidden md:inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="Mark complete"
                >
                  {completing === task.id ? (
                    <span className="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                  ) : (
                    <>&#10003; Done</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Edit Task Modal ───────────────────────────────── */}
      {editingTask && editingTask.type === "task" && (
        <Modal isOpen onClose={() => { setEditingTask(null); setError(""); }}>
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
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
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
                <select name="status" defaultValue={editingTask.taskStatus || "NOT_STARTED"} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select name="priority" defaultValue={editingTask.priority || "MEDIUM"} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                <input name="label" defaultValue={editingTask.label || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
              <button type="button" onClick={() => { setEditingTask(null); setError(""); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Edit Recurring Task Modal ────────────────────── */}
      {editingTask && editingTask.type === "recurring" && (
        <Modal isOpen onClose={() => { setEditingTask(null); setError(""); }}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Recurring Task</h2>
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
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="category" defaultValue={editingTask.category || "Task"} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {RECURRING_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select name="frequencyType" defaultValue={editingTask.frequencyType || "WEEKLY"} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                <input name="frequencyValue" type="number" min={1} defaultValue={editingTask.frequencyValue || 1} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                <select name="scheduleType" defaultValue={editingTask.scheduleType || "FLOATING"} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Completed</label>
              <input name="lastCompleted" type="date" defaultValue={formatDateISO(editingTask.lastCompleted)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" rows={2} defaultValue={editingTask.description || ""} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => { setEditingTask(null); setError(""); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Confirm Complete (Recurring) ──────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmComplete}
        title="Mark as Completed"
        message={`Mark "${confirmComplete?.title}" as completed? This will advance the next due date.`}
        confirmLabel="Complete"
        confirmVariant="success"
        onConfirm={() => confirmComplete && handleComplete(confirmComplete)}
        onCancel={() => setConfirmComplete(null)}
      />
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-red-100 text-red-600",
    MEDIUM: "bg-amber-100 text-amber-600",
    LOW: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[priority] ?? "bg-gray-100 text-gray-500"}`}>
      {priority}
    </span>
  );
}

function formatDateISO(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
