# Project Overview (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/project-overview.md`. Current state lives in `../ARCHITECTURE.md` and the cross-system overview (`docs/system/SYSTEM_OVERVIEW.md` in the Controller repo).

---

## What is ACOMS.OS?

ACOMS.OS is a web-based internal company operations platform. It is designed to be the single source of truth for structured business data across the company.

In plain English: instead of tracking employees, equipment, and tasks in scattered spreadsheets, ACOMS.OS puts everything in one organised, searchable, professional system.

## Who is it for?

- **Admin users** manage records: creating, editing, and archiving employees, assets, plant items, and tasks.
- **Staff users** (future) will have limited access to view their own HR information and selected asset/plant data.

## What does it manage?

### Currently built (Stage 1)

| Module | What it tracks |
|--------|---------------|
| Employee Register | Staff records — names, positions, employment types, locations, status |
| Asset Register | Portable company items — tools, phones, laptops, PPE |
| Plant Register | Large equipment — cars, trucks, excavators, generators |
| Task Manager | Quick tasks with priority, status, due dates, and owner assignment |
| Recurring Tasks | Scheduled recurring tasks with frequency types and calendar view |
| Activity Log | Full audit trail — who changed what, when, and what the changes were |
| Dashboard | Overview of active tasks, overdue items, upcoming deadlines |
| Global Search | Search across employees, assets, plant, and tasks |

> **2026 update:** Tasks and Recurring Tasks have been removed from OS and moved to ACOMS.Controller. The OS Tasks page is now an iframe embed of Controller's `/embed/tasks`.

### Planned for later stages

| Module | Status |
|--------|--------|
| WIP Tracker | Built as a separate app (ACOMS.WIP) |
| Job Creation | Built inside ACOMS.Controller |
| Corrective Actions | Planned |
| File/Document Attachments | Architecture in place, implementation in Stage 3 |
| Reporting & Data Export | Planned |
| AI & Automation | Planned |

## Key principles

1. **Modular** — each area is built as a separate module with clear boundaries
2. **Simple** — admin pages and forms are easy to understand
3. **Documented** — every module has its own documentation
4. **Safe** — records are soft-deleted (archived), never permanently destroyed
5. **Independent from Microsoft 365** — SharePoint can be used for files, but the core system doesn't depend on it
6. **Auditable** — all changes are logged with who, what, and when

## How is it built?

- **Next.js 16** (React 19) for the web interface and API
- **PostgreSQL** (Neon) for the database
- **Prisma 7** for database management
- **TypeScript** for type safety
- **NextAuth.js v5** for authentication (now as OIDC client of ACOMS.Auth)
- **Tailwind CSS v4** for styling
- **Zod** for input validation
