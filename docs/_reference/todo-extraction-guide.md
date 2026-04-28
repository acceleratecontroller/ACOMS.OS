# To-Do / Recurring Tasks — Extraction & Migration Guide (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/todo-extraction-guide.md`.
>
> **Status (2026-04):** Largely executed. Tasks were extracted from ACOMS.OS and now live in ACOMS.Controller's `apps/todo` (commit `dd826499`). The current iframe embed is the result of this guide. Kept here for historical context only — do **not** treat the steps below as live instructions.

The original content follows unchanged for the historical record.

---

> Prepared for migration from ACOMS.OS to a standalone shared-tools module.
> This module will later be consumed by ACOMS.OS, WIP.OS, and other apps via API or package import.

---

## 1. File Inventory

### 1A. Purely To-Do Specific (MOVE to shared-tools)

| File | Purpose |
|------|---------|
| `src/modules/tasks/validation.ts` | Zod schemas for Task and RecurringTask CRUD |
| `src/modules/tasks/recurrence.ts` | `calculateNextDue()` and `advanceDate()` logic |
| `src/app/api/tasks/route.ts` | `GET /api/tasks`, `POST /api/tasks` |
| `src/app/api/tasks/[id]/route.ts` | `GET/PUT/DELETE /api/tasks/[id]` |
| `src/app/api/tasks/[id]/complete/route.ts` | `POST /api/tasks/[id]/complete` |
| `src/app/api/tasks/[id]/restore/route.ts` | `POST /api/tasks/[id]/restore` |
| `src/app/api/recurring-tasks/route.ts` | `GET /api/recurring-tasks`, `POST /api/recurring-tasks` |
| `src/app/api/recurring-tasks/[id]/route.ts` | `GET/PUT/DELETE /api/recurring-tasks/[id]` |
| `src/app/api/recurring-tasks/[id]/complete/route.ts` | `POST /api/recurring-tasks/[id]/complete` |
| `src/app/api/recurring-tasks/[id]/restore/route.ts` | `POST /api/recurring-tasks/[id]/restore` |
| `src/app/(authenticated)/tasks/page.tsx` | Main Task Manager page (full UI) |
| `src/app/(authenticated)/tasks/types.ts` | Task/RecurringTask interfaces, helpers, colour maps |
| `src/app/(authenticated)/tasks/TaskRow.tsx` | Quick task row component |
| `src/app/(authenticated)/tasks/RecurringTaskRow.tsx` | Recurring task row component |
| `src/app/(authenticated)/tasks/RecurringCalendar.tsx` | Calendar view for recurring tasks |
| `src/app/(authenticated)/DashboardTaskCentre.tsx` | Dashboard task command centre widget |

### 1B. Schema Definitions (RECREATE in shared-tools)

| Location | Content |
|----------|---------|
| `prisma/schema.prisma` lines 251-338 | `Task`, `RecurringTask` models + `TaskStatus`, `TaskPriority`, `RecurringFrequency`, `ScheduleType` enums |
| `prisma/schema.prisma` lines 242-244 | Employee relations: `assignedTasks`, `assignedRecurringTasks` |

### 1C. Constants (EXTRACT subset to shared-tools)

| File | Relevant Exports |
|------|-----------------|
| `src/config/constants.ts` lines 168-201 | `TASK_STATUS_OPTIONS`, `PRIORITY_OPTIONS`, `FREQUENCY_OPTIONS`, `SCHEDULE_OPTIONS`, `RECURRING_CATEGORY_OPTIONS` |

### 1D. Shared Infrastructure (LEAVE in ACOMS.OS — recreate equivalents in shared-tools)

| File | What To-Do Uses |
|------|----------------|
| `src/shared/database/client.ts` | `prisma` singleton — Prisma client instance |
| `src/shared/auth/auth.ts` | `auth()` — NextAuth session resolver |
| `src/shared/audit/log.ts` | `audit()`, `diff()` — audit logging functions |
| `src/shared/api/helpers.ts` | `parseBody()`, `validateEmployeeRef()`, `withPrismaError()` |
| `src/shared/components/PageHeader.tsx` | Simple page header component |
| `src/shared/components/Modal.tsx` | Modal overlay component |
| `src/shared/components/ConfirmDialog.tsx` | Confirmation dialog component |

### 1E. Integration Points (LEAVE in ACOMS.OS — modify after extraction)

| File | Integration |
|------|-------------|
| `src/middleware.ts` lines 6-7 | ADMIN_ONLY_ROUTES includes `/tasks`, ADMIN_ONLY_API_ROUTES includes `/api/tasks`, `/api/recurring-tasks` |
| `src/config/navigation.ts` line 17 | "Task Manager" nav item |
| `src/app/api/dashboard/route.ts` | Dashboard fetches task/recurring-task counts and lists |
| `src/app/api/search/route.ts` lines 86-99 | Global search includes Task model |
| `src/app/(authenticated)/page.tsx` | Dashboard page fetches and displays task data via DashboardTaskCentre |

---

The remainder of the original document (sections 2–10: Dependency Map, Coupling Analysis, Schema for Shared-Tools, Step-by-Step Rebuild Plan, Adapter interfaces, Risks, Summary table) is preserved in git history at the original path `docs/todo-extraction-guide.md` prior to this commit. It is omitted here because the work has been executed and the document is no longer normative.
