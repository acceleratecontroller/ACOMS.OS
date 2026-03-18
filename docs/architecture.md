# Architecture

## Overview

ACOMS.OS is a Next.js application using the App Router pattern. It serves both the frontend (web pages) and backend (API endpoints) from a single codebase.

## Folder structure

```
ACOMS.OS/
├── docs/                              Documentation files
├── prisma/
│   ├── schema.prisma                  Database schema (source of truth)
│   └── seed.ts                        Creates initial admin user
├── src/
│   ├── app/                           Next.js App Router
│   │   ├── layout.tsx                 Root layout
│   │   ├── (authenticated)/           Route group for protected pages
│   │   │   ├── layout.tsx             Sidebar + header shell
│   │   │   ├── page.tsx               Dashboard
│   │   │   ├── employees/             Employee register (list, new, [id])
│   │   │   ├── assets/                Asset register (list, [id])
│   │   │   ├── plant/                 Plant register (list, [id])
│   │   │   ├── tasks/                 Task manager (page, TaskRow, RecurringTaskRow, RecurringCalendar, types)
│   │   │   └── activity-log/          Audit trail viewer
│   │   ├── login/page.tsx             Login page
│   │   └── api/                       Backend API routes
│   │       ├── auth/[...nextauth]/    Authentication endpoint
│   │       ├── employees/             Employee CRUD + archive/restore
│   │       ├── assets/                Asset CRUD + archive/restore
│   │       ├── plant/                 Plant CRUD + archive/restore
│   │       ├── tasks/                 Task CRUD + complete + archive/restore
│   │       ├── recurring-tasks/       Recurring task CRUD + complete + archive/restore
│   │       ├── activity-log/          Paginated audit log
│   │       ├── dashboard/             Dashboard summary stats
│   │       └── search/                Global search across entities
│   ├── modules/                       Module-specific business logic
│   │   ├── employees/validation.ts    Employee Zod schemas
│   │   ├── assets/validation.ts       Asset Zod schemas
│   │   ├── plant/validation.ts        Plant Zod schemas
│   │   └── tasks/
│   │       ├── validation.ts          Task + RecurringTask Zod schemas
│   │       └── recurrence.ts          Recurring task scheduling logic
│   ├── shared/                        Reusable code across modules
│   │   ├── api/helpers.ts             API route helpers (parseBody, validateEmployeeRef, withPrismaError)
│   │   ├── audit/log.ts               Fire-and-forget audit logging + diff
│   │   ├── auth/
│   │   │   ├── auth.ts                NextAuth config and exports
│   │   │   └── types.ts               Session/JWT type extensions
│   │   ├── components/                Shared UI components
│   │   │   ├── Sidebar.tsx            Navigation sidebar
│   │   │   ├── GlobalSearch.tsx       Search bar with results
│   │   │   ├── DataTable.tsx          Responsive data table
│   │   │   ├── Modal.tsx              Full-screen modal
│   │   │   ├── ConfirmDialog.tsx      Confirmation dialog
│   │   │   ├── FormField.tsx          Form field components
│   │   │   ├── PageHeader.tsx         Page title/description
│   │   │   ├── StatusBadge.tsx        Color-coded status display
│   │   │   └── AddressAutocomplete.tsx Google Maps address input
│   │   ├── database/client.ts         Prisma singleton client
│   │   └── file-provider/types.ts     File storage interface (placeholder)
│   └── config/
│       ├── navigation.ts              Sidebar navigation items
│       └── constants.ts               Shared option lists and labels
├── .env.example                       Environment variable template
├── package.json                       Dependencies and scripts
└── tsconfig.json                      TypeScript configuration
```

## Key patterns

### Each module follows the same structure

Every register (employees, assets, plant, tasks) has:
- **Pages** in `src/app/(authenticated)/[module]/` — list, create, view/edit
- **API routes** in `src/app/api/[module]/` — GET, POST, PUT, DELETE, archive, restore
- **Validation** in `src/modules/[module]/validation.ts` — Zod schemas

### API route helpers

All API routes use shared helpers from `src/shared/api/helpers.ts`:
- `parseBody()` — safe JSON parsing with clean 400 error on malformed input
- `validateEmployeeRef()` — validates that a referenced employee ID exists
- `withPrismaError()` — wraps Prisma calls with consistent error handling (P2025 not found, P2003 foreign key, P2002 unique constraint)

### Adding a new module

To add a new register (e.g. "Corrective Actions"):
1. Add a Prisma model to `prisma/schema.prisma`
2. Create pages in `src/app/(authenticated)/corrective-actions/`
3. Create API routes in `src/app/api/corrective-actions/`
4. Create validation in `src/modules/corrective-actions/`
5. Add constants to `src/config/constants.ts`
6. Add a nav item in `src/config/navigation.ts`

### Database

- **PostgreSQL** is the database
- **Prisma** manages the schema and provides type-safe queries
- The schema is defined in `prisma/schema.prisma`
- Migrations are tracked in `prisma/migrations/`

### Authentication

- **NextAuth.js (Auth.js v5)** handles login/sessions
- Credentials provider: email + password
- Passwords hashed with bcrypt
- JWT-based sessions
- Role stored in the JWT token (`ADMIN` or `STAFF`)

### Soft-delete

All records use soft-delete:
- `isArchived` flag (default: false)
- `archivedAt` timestamp
- `archivedById` tracks who archived it
- List views filter to `isArchived = false` by default
- No data is permanently deleted through the UI

### Audit trail

All mutations (create, update, archive, restore) are logged to the `AuditLog` table:
- Entity type, ID, and label
- Action performed
- Changes (before/after diff for updates)
- Who performed the action
- Runs fire-and-forget to avoid blocking API responses

### File storage (placeholder)

A `FileProvider` interface is defined in `src/shared/file-provider/types.ts`. This is not implemented in Stage 1 but establishes the interface for a future stage.

## Data model

### Separate User and Employee

- **User** = a login account for the system
- **Employee** = a business record for a real person
- Not every employee has a login
- Assets and plant are assigned to Employees, not Users
- Tasks are owned by Employees
- `createdById` / `archivedById` point to Users (who performed the action)

### Relationships

```
User (login) ──creates──> Employee, Asset, Plant, Task, RecurringTask
User (login) ──archives──> Employee, Asset, Plant, Task, RecurringTask
Employee ──assigned──< Asset (one employee, many assets)
Employee ──assigned──< Plant (one employee, many plant items)
Employee ──owns──< Task (one employee, many tasks)
Employee ──owns──< RecurringTask (one employee, many recurring tasks)
User ──performs──< AuditLog (who did what)
```

---

**Maintenance note:** Update this document when modules, patterns, or structure change.
