# To-Do / Recurring Tasks — Extraction & Migration Guide

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

## 2. Dependency Map

### External Dependencies

```
zod/v4          — validation schemas
@prisma/client  — ORM / database access
next/server     — API route handlers (NextRequest, NextResponse)
next-auth       — authentication (session)
react           — UI components
```

### Internal Dependencies (To-Do → ACOMS.OS)

```
To-Do API Routes
  ├── @/shared/database/client     → prisma instance
  ├── @/shared/auth/auth           → auth() session check
  ├── @/shared/audit/log           → audit(), diff()
  ├── @/shared/api/helpers         → parseBody(), validateEmployeeRef(), withPrismaError()
  └── @/modules/tasks/*            → validation schemas, recurrence logic

To-Do Frontend
  ├── @/shared/components/PageHeader
  ├── @/shared/components/Modal
  ├── @/shared/components/ConfirmDialog
  ├── @/config/constants           → TASK_STATUS_OPTIONS, etc.
  └── /api/employees               → fetches employee list for owner dropdowns
  └── /api/auth/session            → checks admin role on client side
```

### Database Relations (To-Do → ACOMS.OS)

```
Task.ownerId       → Employee.id    (FK)
Task.createdById   → User.id        (FK)
Task.archivedById  → User.id        (FK, nullable)
RecurringTask.*    → same pattern as Task

Employee model has reverse relations:
  assignedTasks          Task[]          @relation("TaskOwner")
  assignedRecurringTasks RecurringTask[] @relation("RecurringTaskOwner")

User model has reverse relations:
  tasksCreated              Task[]          @relation("TaskCreatedBy")
  tasksArchived             Task[]          @relation("TaskArchivedBy")
  recurringTasksCreated     RecurringTask[] @relation("RecurringTaskCreatedBy")
  recurringTasksArchived    RecurringTask[] @relation("RecurringTaskArchivedBy")
```

---

## 3. Coupling Analysis — Move vs Rewrite vs Leave Behind

### MOVE (copy directly, minimal changes)

| Item | Notes |
|------|-------|
| `src/modules/tasks/validation.ts` | Zero ACOMS.OS coupling — pure Zod schemas |
| `src/modules/tasks/recurrence.ts` | Zero coupling — pure date math |
| `src/app/(authenticated)/tasks/types.ts` | Only imports `TASK_STATUS_OPTIONS` and `FREQUENCY_OPTIONS` from constants — move these with it |
| `src/app/(authenticated)/tasks/TaskRow.tsx` | Pure presentational, imports only from sibling `types.ts` |
| `src/app/(authenticated)/tasks/RecurringTaskRow.tsx` | Same — pure presentational |
| `src/app/(authenticated)/tasks/RecurringCalendar.tsx` | Same — pure presentational |
| Task-specific constants from `src/config/constants.ts` | Can be extracted as standalone constants file |

### REWRITE (logic is correct but must be adapted for standalone use)

| Item | Why |
|------|-----|
| All API routes (`/api/tasks/*`, `/api/recurring-tasks/*`) | Currently import `auth()`, `audit()`, `prisma`, `parseBody()`, `validateEmployeeRef()`, `withPrismaError()` from ACOMS.OS shared modules. Must be rewritten to use the shared-tools' own auth/audit/db layer. |
| `src/app/(authenticated)/tasks/page.tsx` | Fetches from `/api/employees` (ACOMS.OS-specific), checks session via `/api/auth/session`. Must accept employee list via prop or config. |
| `src/app/(authenticated)/DashboardTaskCentre.tsx` | Deeply embedded in ACOMS.OS dashboard. Should become a standalone widget that receives data via props or its own API calls. |
| Database schema (Task, RecurringTask) | Must be recreated with abstracted owner concept (not direct FK to ACOMS.OS Employee table). |
| `src/app/api/dashboard/route.ts` | Task portions need extraction into a dedicated task summary endpoint inside the shared module. |

### LEAVE BEHIND (do not move — ACOMS.OS-specific)

| Item | Why |
|------|-----|
| `src/shared/auth/auth.ts` | ACOMS.OS NextAuth config — shared-tools needs its own auth strategy |
| `src/shared/database/client.ts` | ACOMS.OS Prisma client — shared-tools needs its own |
| `src/shared/audit/log.ts` | ACOMS.OS audit trail — shared-tools should implement its own or accept an audit adapter |
| `src/shared/api/helpers.ts` | `validateEmployeeRef()` queries ACOMS.OS Employee table; `parseBody()`/`withPrismaError()` are generic and can be recreated |
| `src/middleware.ts` | ACOMS.OS route-level auth — will need to add task routes when re-integrating |
| `src/config/navigation.ts` | ACOMS.OS sidebar config |
| `src/app/api/search/route.ts` | ACOMS.OS global search |
| `src/app/(authenticated)/page.tsx` | ACOMS.OS dashboard |

---

## 4. Coupling Points & Abstraction Plan

### 4.1 Employee Assignment (ownerId)

**Current behaviour:** Task.ownerId is a direct FK to the ACOMS.OS `Employee` table. API routes validate via `validateEmployeeRef()` which queries `prisma.employee.findUnique()`. Frontend fetches `/api/employees` to populate owner dropdowns.

**After extraction:**
- The shared-tools module should define an `assigneeId` field (generic string, not FK).
- Validation should accept an `AssigneeResolver` interface:
  ```ts
  interface AssigneeResolver {
    validate(id: string): Promise<boolean>;
    list(): Promise<{ id: string; name: string }[]>;
  }
  ```
- ACOMS.OS provides an implementation that maps to its Employee table.
- WIP.OS provides its own implementation.
- The frontend should accept an `assignees` prop or use a configurable endpoint.

### 4.2 Authentication & Authorisation

**Current behaviour:** Every API route calls `auth()` from NextAuth, checks `session.user.role === "ADMIN"`. Middleware blocks STAFF from `/tasks` routes.

**After extraction:**
- The shared module should define an auth middleware interface:
  ```ts
  interface TaskAuthContext {
    userId: string;
    role: string;
    isAdmin: boolean;
    assigneeId?: string; // optional: for filtering own tasks
  }
  ```
- API routes should accept a `getAuthContext(request)` function injected by the consuming app.
- ACOMS.OS wraps its `auth()` call into this adapter.

### 4.3 Audit Logging

**Current behaviour:** All create/update/archive/restore operations call `audit()` which writes to the ACOMS.OS `AuditLog` table.

**After extraction:**
- Define an audit adapter interface:
  ```ts
  interface AuditLogger {
    log(entry: { entityType: string; entityId: string; action: string; entityLabel: string; performedById: string; changes?: Record<string, unknown> | null }): void;
  }
  ```
- Default: no-op logger. ACOMS.OS provides its real audit implementation.
- This avoids the shared module depending on the ACOMS.OS AuditLog table.

### 4.4 Database Access

**Current behaviour:** All routes use `prisma` imported from `@/shared/database/client` and query `prisma.task.*` / `prisma.recurringTask.*` directly. Models are defined in the ACOMS.OS Prisma schema with FK relations to Employee and User.

**After extraction:**
- The shared-tools module should have its own Prisma schema with Task and RecurringTask models.
- Replace `ownerId → Employee` FK with `assigneeId String` (no FK constraint — validated at app layer).
- Replace `createdById → User` FK with `createdById String` (no FK).
- The module owns its own database connection (can be same DB, separate schema, or separate DB).
- When deployed within ACOMS.OS, the module can share the same Prisma client via dependency injection.

### 4.5 Shared UI Components (Modal, ConfirmDialog, PageHeader)

**Current behaviour:** Task pages import these from `@/shared/components/*`.

**After extraction:**
- Option A: The shared-tools repo includes its own copies of these generic components.
- Option B: These move into a shared UI library that both repos consume.
- Option C (simplest): The shared-tools module defines component interfaces and the consuming app provides them via a provider/context.

### 4.6 Dashboard Integration

**Current behaviour:** The ACOMS.OS dashboard page (`page.tsx`) makes ~12 Prisma queries for task stats and passes them to `DashboardTaskCentre`. The `/api/dashboard` route also returns task stats.

**After extraction:**
- The shared module exposes a `getTaskSummary(filters)` function/API endpoint that returns all task stats.
- ACOMS.OS dashboard calls this endpoint instead of making direct Prisma queries.
- `DashboardTaskCentre` becomes a self-contained widget that fetches its own data from the shared module's API.

### 4.7 Global Search Integration

**Current behaviour:** `src/app/api/search/route.ts` includes Task in its search results for admin users.

**After extraction:**
- The shared module exposes a `searchTasks(term, options)` function/API.
- ACOMS.OS search route calls this and merges results with its other search results.

---

## 5. Database Schema for Shared-Tools

The following schema should be created in the shared-tools repo. It removes all FK constraints to ACOMS.OS tables and uses plain string IDs for assignees and users.

```prisma
// ─── Task Enums ───────────────────────────────────────────

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  STUCK
  AWAITING_RESPONSE
  COMPLETED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}

enum RecurringFrequency {
  WEEKLY
  FORTNIGHTLY
  MONTHLY
  QUARTERLY
  YEARLY
}

enum ScheduleType {
  FIXED
  FLOATING
}

// ─── Task (Quick Tasks) ──────────────────────────────────

model Task {
  id         String       @id @default(uuid())
  title      String
  projectId  String?
  notes      String?
  label      String       @default("Task")
  dueDate    DateTime?
  status     TaskStatus   @default(NOT_STARTED)
  priority   TaskPriority @default(LOW)

  // Generic assignee — resolved by consuming app
  assigneeId   String
  // Tracks who created/archived — consuming app maps to its User
  createdById  String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  isArchived   Boolean  @default(false)
  archivedAt   DateTime?
  archivedById String?

  // Context: which app/tenant owns this task
  appId        String   @default("default")

  @@index([status])
  @@index([dueDate])
  @@index([assigneeId])
  @@index([appId])
}

// ─── Recurring Task ──────────────────────────────────────

model RecurringTask {
  id              String             @id @default(uuid())
  title           String
  description     String?
  category        String             @default("Task")
  frequencyType   RecurringFrequency @default(WEEKLY)
  frequencyValue  Int                @default(1)
  scheduleType    ScheduleType       @default(FLOATING)
  lastCompleted   DateTime?
  nextDue         DateTime?

  assigneeId   String
  createdById  String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  isArchived   Boolean  @default(false)
  archivedAt   DateTime?
  archivedById String?

  appId        String   @default("default")

  @@index([nextDue])
  @@index([assigneeId])
  @@index([appId])
}
```

Key differences from ACOMS.OS schema:
- `ownerId` → `assigneeId` (generic, no FK)
- `createdById` / `archivedById` no longer FK to User
- No `@relation()` decorators — consuming app handles resolution
- Added `appId` for multi-tenant support (e.g., ACOMS.OS vs WIP.OS)

---

## 6. Step-by-Step Rebuild Plan for Shared-Tools Repo

### Phase 1: Scaffold the shared-tools repo

1. Create new monorepo: `shared-tools/`
2. Initialise with Next.js (or a framework-agnostic structure if needed)
3. Set up Prisma with the schema from Section 5
4. Install dependencies: `zod`, `@prisma/client`, `next`, `react`

### Phase 2: Port pure logic (zero changes needed)

1. Copy `src/modules/tasks/validation.ts` → `packages/tasks/src/validation.ts`
2. Copy `src/modules/tasks/recurrence.ts` → `packages/tasks/src/recurrence.ts`
3. Extract task constants into `packages/tasks/src/constants.ts`:
   - `TASK_STATUS_OPTIONS`, `PRIORITY_OPTIONS`, `FREQUENCY_OPTIONS`, `SCHEDULE_OPTIONS`, `RECURRING_CATEGORY_OPTIONS`

### Phase 3: Define adapter interfaces

Create `packages/tasks/src/adapters.ts`:
```ts
export interface TaskAuthContext {
  userId: string;
  role: string;
  isAdmin: boolean;
  assigneeId?: string;
}

export interface AssigneeResolver {
  validate(id: string): Promise<boolean>;
  list(): Promise<{ id: string; name: string }[]>;
}

export interface AuditLogger {
  log(entry: {
    entityType: string;
    entityId: string;
    action: string;
    entityLabel: string;
    performedById: string;
    changes?: Record<string, unknown> | null;
  }): void;
}

export interface TaskModuleConfig {
  getAuthContext: (request: Request) => Promise<TaskAuthContext | null>;
  assigneeResolver: AssigneeResolver;
  auditLogger: AuditLogger;
  appId?: string;
}
```

### Phase 4: Rewrite API routes with adapters

1. Port each API route, replacing:
   - `auth()` → `config.getAuthContext(request)`
   - `validateEmployeeRef()` → `config.assigneeResolver.validate()`
   - `audit()` → `config.auditLogger.log()`
   - `prisma` → module's own Prisma instance
   - `ownerId` → `assigneeId` in all queries
2. Add `appId` filtering to all queries
3. Create a new `/api/tasks/summary` endpoint for dashboard stats

### Phase 5: Port frontend components

1. Copy TaskRow, RecurringTaskRow, RecurringCalendar, types.ts as-is
2. Refactor the main page to accept configuration via props:
   - `assignees` list (instead of fetching `/api/employees`)
   - `isAdmin` flag (instead of checking session)
   - `apiBaseUrl` (so it can point to standalone or embedded API)
3. Port DashboardTaskCentre as a standalone widget

### Phase 6: Create ACOMS.OS adapter package

Create `packages/tasks-acoms-adapter/`:
```ts
import { TaskModuleConfig } from "@shared-tools/tasks";
import { auth } from "@/shared/auth/auth";
import { audit, diff } from "@/shared/audit/log";
import { prisma } from "@/shared/database/client";

export const acomsTaskConfig: TaskModuleConfig = {
  async getAuthContext(request) {
    const session = await auth();
    if (!session?.user) return null;
    return {
      userId: session.user.id,
      role: session.user.role,
      isAdmin: session.user.role === "ADMIN",
      assigneeId: session.user.employeeId,
    };
  },
  assigneeResolver: {
    async validate(id) {
      const emp = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
      return !!emp;
    },
    async list() {
      const employees = await prisma.employee.findMany({
        where: { isArchived: false, status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      });
      return employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }));
    },
  },
  auditLogger: {
    log(entry) { audit(entry as any); },
  },
  appId: "acoms",
};
```

### Phase 7: Re-integrate into ACOMS.OS

1. Remove the original To-Do files from ACOMS.OS
2. Remove Task/RecurringTask models from the ACOMS.OS Prisma schema
3. Remove Employee ↔ Task relations from the schema
4. Install the shared-tools task package
5. Wire up the ACOMS.OS adapter
6. Update middleware, navigation, search, and dashboard to use the shared module's APIs
7. Run database migration to update the schema

---

## 7. Environment Variables & Config Required

The shared-tools task module needs:

| Variable | Purpose | Current ACOMS.OS Equivalent |
|----------|---------|----------------------------|
| `DATABASE_URL` | PostgreSQL connection for task tables | Same `DATABASE_URL` (can share DB or use separate) |
| `APP_ID` | Multi-tenant identifier | New — set to `"acoms"` for ACOMS.OS |

The module does NOT need:
- `AUTH_SECRET` — authentication is handled by the consuming app's adapter
- `NEXTAUTH_URL` — same reason
- Any ACOMS.OS-specific env vars

---

## 8. Recommended Pre-Extraction Refactors (in ACOMS.OS)

These changes make the current code easier to extract without breaking ACOMS.OS:

### 8.1 Extract task constants to their own file
Move task-specific constants out of the shared `constants.ts` into `src/modules/tasks/constants.ts`. This makes it clear what moves with the module.

### 8.2 Create a task service layer
Currently API routes contain business logic inline. Extracting to a service layer (`src/modules/tasks/service.ts`) that accepts dependencies makes the logic portable:
```ts
// src/modules/tasks/service.ts
export function createTaskService(deps: { prisma, audit, validateAssignee }) {
  return {
    list(filters) { ... },
    create(data, userId) { ... },
    update(id, data, userId) { ... },
    archive(id, userId) { ... },
    restore(id, userId) { ... },
    complete(id, userId) { ... },
  };
}
```

### 8.3 Normalise the "ownerId" terminology
Rename to `assigneeId` in the shared module. During transition, ACOMS.OS can keep `ownerId` in its schema and map it in the adapter.

---

## 9. Risks & Considerations

1. **Database migration**: If sharing the same PostgreSQL database, removing FK constraints from Task → Employee/User requires a migration. Ensure this doesn't break existing data.

2. **Audit log continuity**: Existing audit log entries reference entity types "Task" and "RecurringTask". The shared module should keep these names.

3. **Dashboard performance**: The current dashboard makes many parallel Prisma queries for task stats. The shared module should expose a single optimised summary endpoint.

4. **Admin-only access**: The current system is admin-only. The shared module should support configurable roles, not hard-code ADMIN.

5. **Timezone handling**: Recurrence logic uses `new Date()` without timezone awareness. Consider standardising on UTC in the shared module.

---

## 10. Summary — Quick Reference

| Category | Count | Action |
|----------|-------|--------|
| Pure To-Do files (move as-is) | 7 | Copy directly |
| API route files (rewrite with adapters) | 8 | Port with dependency injection |
| Frontend components (move + adapt) | 5 | Copy, update imports/config |
| Schema definitions (recreate) | 2 models, 4 enums | New standalone schema |
| Constants (extract subset) | 5 constants | Move to module |
| Shared infra (leave, recreate equivalents) | 6 files | Build adapters |
| Integration points (leave, update later) | 5 files | Modify after extraction |
