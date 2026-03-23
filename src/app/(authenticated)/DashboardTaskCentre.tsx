"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
} from "@/modules/tasks/constants";

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

type ViewMode = "all" | "quick" | "recurring";
type FilterKey = "all" | "overdue" | "due-today" | "due-soon" | "not-started" | "in-progress" | "stuck" | "completed" | "high";
type SortKey = "due-date" | "priority" | "owner" | "status" | "title";

const STATUS_OPTIONS = TASK_STATUS_OPTIONS;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "due-date", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "owner", label: "Owner" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
];

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_URGENCY: Record<string, number> = { overdue: 0, "due-today": 1, "due-soon": 2 };

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
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("due-date");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [editingTask, setEditingTask] = useState<DashboardTaskItem | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<DashboardTaskItem | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<DashboardTaskItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close action menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Split tasks by view mode
  const quickTasks = useMemo(() => tasks.filter((t) => t.type === "task"), [tasks]);
  const recurringTasks = useMemo(() => tasks.filter((t) => t.type === "recurring"), [tasks]);
  const baseTasks = viewMode === "quick" ? quickTasks : viewMode === "recurring" ? recurringTasks : tasks;

  // Filter counts (computed on baseTasks for current view)
  const filterCounts = useMemo((): Record<FilterKey, number> => {
    const t: DashboardTaskItem[] = baseTasks;
    return {
      all: t.length,
      overdue: t.filter((x: DashboardTaskItem) => x.status === "overdue").length,
      "due-today": t.filter((x: DashboardTaskItem) => x.status === "due-today").length,
      "due-soon": t.filter((x: DashboardTaskItem) => x.status === "due-soon").length,
      "not-started": t.filter((x: DashboardTaskItem) => x.taskStatus === "NOT_STARTED").length,
      "in-progress": t.filter((x: DashboardTaskItem) => x.taskStatus === "IN_PROGRESS").length,
      stuck: t.filter((x: DashboardTaskItem) => x.taskStatus === "STUCK" || x.taskStatus === "AWAITING_RESPONSE").length,
      completed: t.filter((x: DashboardTaskItem) => x.taskStatus === "COMPLETED").length,
      high: t.filter((x: DashboardTaskItem) => x.priority === "HIGH").length,
    };
  }, [baseTasks]);

  // Unique owners for filter
  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    baseTasks.forEach((t: DashboardTaskItem) => map.set(t.ownerId, t.owner));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseTasks]);

  // Apply filters, search, owner, sort
  const filtered = useMemo(() => {
    let result = [...baseTasks];

    // Filter
    if (activeFilter === "overdue") result = result.filter((t) => t.status === "overdue");
    else if (activeFilter === "due-today") result = result.filter((t) => t.status === "due-today");
    else if (activeFilter === "due-soon") result = result.filter((t) => t.status === "due-soon");
    else if (activeFilter === "not-started") result = result.filter((t) => t.taskStatus === "NOT_STARTED");
    else if (activeFilter === "in-progress") result = result.filter((t) => t.taskStatus === "IN_PROGRESS");
    else if (activeFilter === "stuck") result = result.filter((t) => t.taskStatus === "STUCK" || t.taskStatus === "AWAITING_RESPONSE");
    else if (activeFilter === "completed") result = result.filter((t) => t.taskStatus === "COMPLETED");
    else if (activeFilter === "high") result = result.filter((t) => t.priority === "HIGH");

    // Owner filter
    if (ownerFilter !== "all") result = result.filter((t) => t.ownerId === ownerFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "due-date") return (STATUS_URGENCY[a.status] ?? 9) - (STATUS_URGENCY[b.status] ?? 9);
      if (sortBy === "priority") return (PRIORITY_ORDER[a.priority || "MEDIUM"] ?? 9) - (PRIORITY_ORDER[b.priority || "MEDIUM"] ?? 9);
      if (sortBy === "owner") return a.owner.localeCompare(b.owner);
      if (sortBy === "status") return (a.taskStatus || "").localeCompare(b.taskStatus || "");
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return result;
  }, [baseTasks, activeFilter, ownerFilter, search, sortBy]);

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

  // ─── Archive handler ──────────────────────────────────

  const handleArchive = useCallback(async (task: DashboardTaskItem) => {
    try {
      const realId = task.id.replace(/^(r-|td-|rt-|s-|rs-)/, "");
      const url = task.type === "recurring"
        ? `/api/recurring-tasks/${realId}`
        : `/api/tasks/${realId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive");
      setConfirmArchive(null);
      setEditingTask(null);
      router.refresh();
    } catch {
      // silently fail
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

  // ─── Create task handler ──────────────────────────────

  const handleCreateTask = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const body = {
        title: fd.get("title"),
        ownerId: fd.get("ownerId"),
        projectId: fd.get("projectId") || null,
        status: fd.get("status") || "NOT_STARTED",
        priority: fd.get("priority") || "MEDIUM",
        dueDate: fd.get("dueDate") || null,
        label: fd.get("label") || "",
        notes: fd.get("notes") || null,
      };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create task");
      }
      setShowAddTask(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }, [router]);

  return (
    <>
      <div className="lg:col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
        {/* ─── Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              Task Manager
            </h2>
            <span className="text-xs text-gray-400">{viewAll ? "All team tasks" : "Your assigned tasks"}</span>
          </div>
          <Link href="/tasks" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">Open full view</Link>
        </div>

        {/* ─── View Tabs ──────────────────────────────────── */}
        <div className="flex items-center gap-0 px-5 border-b border-gray-200">
          {([
            { key: "all" as ViewMode, label: "All", count: tasks.length },
            { key: "quick" as ViewMode, label: "Quick Tasks", count: quickTasks.length },
            { key: "recurring" as ViewMode, label: "Recurring", count: recurringTasks.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setViewMode(tab.key); setActiveFilter("all"); }}
              className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors ${
                viewMode === tab.key
                  ? "text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs tabular-nums text-gray-400">{tab.count}</span>
              {viewMode === tab.key && <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-gray-900 rounded-full" />}
            </button>
          ))}
        </div>

        {/* ─── Quick Tasks / All View ─────────────────────── */}
        {(viewMode === "quick" || viewMode === "all") && (
          <>
            {/* Command Bar */}
            <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-gray-100 bg-gray-50/50">
              {/* Search */}
              <div className="relative flex-1 max-w-[220px]">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 placeholder:text-gray-400"
                />
              </div>
              {/* Owner filter */}
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 max-w-[150px]"
              >
                <option value="all">All owners</option>
                {ownerOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-xs bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>Sort: {o.label}</option>
                ))}
              </select>
              {/* Spacer */}
              <div className="flex-1" />
              {/* Add Task */}
              <button
                onClick={() => { setShowAddTask(true); setError(""); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-gray-800 rounded-md px-3 py-1.5 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 px-5 py-2 border-b border-gray-100 overflow-x-auto">
              <FilterChip label="All" count={filterCounts.all} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
              <span className="w-px h-4 bg-gray-200 mx-0.5" />
              <FilterChip label="Overdue" count={filterCounts.overdue} active={activeFilter === "overdue"} onClick={() => setActiveFilter("overdue")} variant="red" />
              <FilterChip label="Due Today" count={filterCounts["due-today"]} active={activeFilter === "due-today"} onClick={() => setActiveFilter("due-today")} variant="orange" />
              <FilterChip label="Due Soon" count={filterCounts["due-soon"]} active={activeFilter === "due-soon"} onClick={() => setActiveFilter("due-soon")} variant="blue" />
              <span className="w-px h-4 bg-gray-200 mx-0.5" />
              <FilterChip label="Not Started" count={filterCounts["not-started"]} active={activeFilter === "not-started"} onClick={() => setActiveFilter("not-started")} />
              <FilterChip label="In Progress" count={filterCounts["in-progress"]} active={activeFilter === "in-progress"} onClick={() => setActiveFilter("in-progress")} />
              <FilterChip label="Stuck" count={filterCounts.stuck} active={activeFilter === "stuck"} onClick={() => setActiveFilter("stuck")} variant="red" />
              <span className="w-px h-4 bg-gray-200 mx-0.5" />
              <FilterChip label="High" count={filterCounts.high} active={activeFilter === "high"} onClick={() => setActiveFilter("high")} variant="orange" />
            </div>

            {/* Table Header */}
            <div className={`hidden md:grid items-center gap-0 px-5 py-2 border-b border-gray-200 bg-gray-50/80 text-[11px] font-medium text-gray-400 uppercase tracking-wide ${
              viewMode === "all"
                ? "grid-cols-[3px_1fr_52px_100px_72px_80px_88px_80px_68px]"
                : "grid-cols-[3px_1fr_100px_72px_80px_88px_80px_68px]"
            }`}>
              <span />
              <span className="pl-3">Task</span>
              {viewMode === "all" && <span>Type</span>}
              <span>Owner</span>
              <span>Priority</span>
              <span>Due</span>
              <span>Status</span>
              <span>Progress</span>
              <span className="text-center">Actions</span>
            </div>

            {/* Task Rows */}
            <div className="flex-1 overflow-y-auto max-h-[420px]">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm text-gray-400 font-medium">No tasks match your filters</p>
                  <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                filtered.map((task) => {
                  const accentColor = task.status === "overdue" ? "bg-red-500" : task.status === "due-today" ? "bg-orange-400" : "bg-blue-400";
                  const isStuck = task.taskStatus === "STUCK" || task.taskStatus === "AWAITING_RESPONSE";
                  return (
                    <div
                      key={task.id}
                      className={`group grid grid-cols-[3px_1fr_auto] items-center gap-0 px-5 border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors ${
                        viewMode === "all"
                          ? "md:grid-cols-[3px_1fr_52px_100px_72px_80px_88px_80px_68px]"
                          : "md:grid-cols-[3px_1fr_100px_72px_80px_88px_80px_68px]"
                      }`}
                      onClick={() => setEditingTask(task)}
                    >
                      {/* Left accent */}
                      <span className={`w-[3px] h-8 rounded-full ${accentColor}`} />

                      {/* Title */}
                      <div className="min-w-0 pl-3 py-2.5">
                        <span className={`text-sm font-medium truncate block leading-snug ${
                          isStuck ? "text-red-600" : task.status === "overdue" ? "text-gray-900" : "text-gray-800"
                        }`}>
                          {task.title}
                        </span>
                        <span className="text-xs text-gray-400 md:hidden">
                          {task.owner} &middot; {task.dateLabel}
                        </span>
                      </div>

                      {/* Type (all view only) */}
                      {viewMode === "all" && (
                        <span className={`hidden md:inline-block text-[11px] font-medium px-1.5 py-0.5 rounded text-center ${
                          task.type === "recurring" ? "bg-violet-50 text-violet-600" : "bg-gray-50 text-gray-400"
                        }`}>
                          {task.type === "recurring" ? "Rec." : "Task"}
                        </span>
                      )}

                      {/* Owner */}
                      <span className="hidden md:block text-xs text-gray-500 truncate pr-2">{task.owner}</span>

                      {/* Priority */}
                      <span className="hidden md:block">
                        {task.priority ? <PriorityDot priority={task.priority} /> : <span className="text-xs text-gray-300">&mdash;</span>}
                      </span>

                      {/* Due */}
                      <span className={`hidden md:block text-xs tabular-nums ${
                        task.status === "overdue" ? "text-red-600 font-semibold" : task.status === "due-today" ? "text-orange-600 font-medium" : "text-gray-500"
                      }`}>
                        {task.dateLabel}
                      </span>

                      {/* Status badge */}
                      <span className={`hidden md:inline-block text-[11px] font-medium px-2 py-0.5 rounded text-center whitespace-nowrap ${
                        task.status === "overdue" ? "bg-red-50 text-red-700" :
                        task.status === "due-today" ? "bg-orange-50 text-orange-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {task.status === "overdue" ? "Overdue" : task.status === "due-today" ? "Today" : "Soon"}
                      </span>

                      {/* Progress */}
                      <span className="hidden md:block">
                        {task.taskStatus ? <ProgressBadge status={task.taskStatus} /> : <span className="text-xs text-gray-300">&mdash;</span>}
                      </span>

                      {/* Actions */}
                      <div className="hidden md:flex items-center justify-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => task.type === "recurring" ? setConfirmComplete(task) : handleComplete(task)}
                          disabled={completing === task.id}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                          title="Complete"
                        >
                          {completing === task.id ? (
                            <span className="w-3.5 h-3.5 border-[1.5px] border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => setActionMenuId(actionMenuId === task.id ? null : task.id)}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="More actions"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {actionMenuId === task.id && (
                          <div ref={actionMenuRef} className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                            <button onClick={() => { setEditingTask(task); setActionMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                              Edit task
                            </button>
                            <button onClick={() => { setConfirmArchive(task); setActionMenuId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                              Archive
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer summary */}
            {filtered.length > 0 && (
              <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
                {filtered.length} task{filtered.length !== 1 ? "s" : ""}{activeFilter !== "all" || ownerFilter !== "all" || search ? " (filtered)" : ""} &middot; {filterCounts.overdue} overdue &middot; {filterCounts["due-today"]} due today
              </div>
            )}
          </>
        )}

        {/* ─── Recurring View (unchanged — placeholder passthrough) ── */}
        {viewMode === "recurring" && (
          <>
            <div className="divide-y divide-gray-50 max-h-[460px] overflow-y-auto">
              {recurringTasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">No recurring tasks due</div>
              ) : (
                recurringTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setEditingTask(task)}
                  >
                    <span className={`w-[3px] h-8 rounded-full shrink-0 ${
                      task.status === "overdue" ? "bg-red-500" : task.status === "due-today" ? "bg-orange-400" : "bg-blue-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate block text-sm">{task.title}</span>
                      <span className="text-xs text-gray-400">{task.owner} &middot; {task.dateLabel}</span>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap ${
                      task.status === "overdue" ? "bg-red-50 text-red-700" :
                      task.status === "due-today" ? "bg-orange-50 text-orange-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {task.status === "overdue" ? "Overdue" : task.status === "due-today" ? "Today" : "Soon"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmComplete(task); }}
                      disabled={completing === task.id}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                      title="Complete"
                    >
                      {completing === task.id ? (
                        <span className="w-3.5 h-3.5 border-[1.5px] border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Add Task Modal ────────────────────────────────── */}
      {showAddTask && (
        <Modal isOpen onClose={() => { setShowAddTask(false); setError(""); }}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Quick Task</h2>
          <form onSubmit={handleCreateTask} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input name="title" required autoFocus className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                <select name="ownerId" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                <input name="projectId" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select name="priority" defaultValue="MEDIUM" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input name="dueDate" type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Progress</label>
                <select name="status" defaultValue="NOT_STARTED" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input name="label" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea name="notes" rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Creating..." : "Create Task"}
              </button>
              <button type="button" onClick={() => { setShowAddTask(false); setError(""); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

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
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={() => { setEditingTask(null); setError(""); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
              <button type="button" onClick={() => setConfirmArchive(editingTask)} className="text-red-600 hover:text-red-700 text-sm font-medium hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                Archive
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
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={() => { setEditingTask(null); setError(""); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
              <button type="button" onClick={() => setConfirmArchive(editingTask)} className="text-red-600 hover:text-red-700 text-sm font-medium hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                Archive
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Confirm Archive ───────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmArchive}
        title="Archive Task"
        message={`Archive "${confirmArchive?.title}"? It will be moved to the archived list.`}
        confirmLabel="Archive"
        confirmVariant="danger"
        onConfirm={() => confirmArchive && handleArchive(confirmArchive)}
        onCancel={() => setConfirmArchive(null)}
      />

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

// ─── Filter Chip ────────────────────────────────────────

function FilterChip({ label, count, active, onClick, variant }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  variant?: "red" | "orange" | "blue";
}) {
  const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer";
  const activeStyle = variant === "red" ? "bg-red-600 text-white"
    : variant === "orange" ? "bg-orange-500 text-white"
    : variant === "blue" ? "bg-blue-600 text-white"
    : "bg-gray-800 text-white";
  const inactiveStyle = "text-gray-500 hover:bg-gray-100";
  return (
    <button onClick={onClick} className={`${base} ${active ? activeStyle : inactiveStyle}`}>
      {label}
      <span className={`tabular-nums ${active ? "opacity-80" : "text-gray-400"}`}>{count}</span>
    </button>
  );
}

// ─── Priority Dot ───────────────────────────────────────

function PriorityDot({ priority }: { priority: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    HIGH: { color: "bg-red-500", label: "High" },
    MEDIUM: { color: "bg-amber-400", label: "Med" },
    LOW: { color: "bg-gray-300", label: "Low" },
  };
  const c = cfg[priority] ?? cfg.LOW;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-xs text-gray-500">{c.label}</span>
    </span>
  );
}

// ─── Progress Badge ─────────────────────────────────────

function ProgressBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    NOT_STARTED: "text-gray-400",
    IN_PROGRESS: "text-blue-600",
    STUCK: "text-red-600 font-semibold",
    AWAITING_RESPONSE: "text-orange-600",
    COMPLETED: "text-green-600",
  };
  const labels: Record<string, string> = {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "Active",
    STUCK: "Stuck",
    AWAITING_RESPONSE: "Waiting",
    COMPLETED: "Done",
  };
  return (
    <span className={`text-xs ${styles[status] ?? "text-gray-400"}`}>
      {labels[status] ?? status}
    </span>
  );
}

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
