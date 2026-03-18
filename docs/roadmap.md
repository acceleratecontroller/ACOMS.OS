# Roadmap

## Stage overview

| Stage | Name | Status | What it delivers |
|-------|------|--------|-----------------|
| 1 | Foundation + Core Registers | **Complete** | Project setup, Employee/Asset/Plant registers, Task Manager, Activity Log, Dashboard, admin auth, documentation |
| 2 | Enrichment | Planned | Pagination, sorting, data export, status workflow refinements |
| 3 | File Integration | Planned | File provider implementation, attach documents to records |
| 4 | Staff Access | Planned | Staff logins, restricted views, permission enforcement |
| 5 | WIP & Job Creation | Planned | WIP tracker, job creation (requires business requirements) |
| 6 | Corrective Actions | Planned | Corrective actions register, compliance registers |
| 7 | Reporting & Dashboards | Planned | Advanced filtering, exporting, summary views |
| 8 | AI & Automation | Planned | AI-assisted features, notifications, automated workflows |

## Stage 1 — Foundation + Core Registers (complete)

### What is finished

- [x] Next.js project with TypeScript and Tailwind CSS
- [x] PostgreSQL database schema (Prisma)
- [x] User table for authentication (separate from Employee)
- [x] Employee Register — list, create, view, edit, archive/restore
- [x] Asset Register — list, create, view, edit, archive/restore
- [x] Plant Register — list, create, view, edit, archive/restore
- [x] Task Manager — quick tasks with status, priority, due dates
- [x] Recurring Tasks — scheduled tasks with frequency, calendar view
- [x] Activity Log — paginated audit trail with filters
- [x] Dashboard — overdue/upcoming task summaries
- [x] Global search across employees, assets, plant, tasks
- [x] Admin authentication with NextAuth.js (ADMIN/STAFF roles)
- [x] Soft-delete/archive on all records
- [x] Zod validation on all API inputs
- [x] Consistent API error handling (parseBody, withPrismaError, validateEmployeeRef)
- [x] File provider interface (placeholder only)
- [x] Sidebar navigation
- [x] Shared constants configuration
- [x] All documentation files

### Known limitations (to address in later stages)

- No tests or CI/CD
- No pagination on list endpoints (except activity log)
- No client-side form validation
- No rate limiting
- No field-level access control
- File attachments not implemented

## Stage 2 — Enrichment (planned)

- Pagination on all list endpoints
- Sorting by column
- Status workflow refinements
- Data export (CSV)

## Stage 3 — File Integration (planned)

- Implement the FileProvider interface
- First provider: SharePoint (or alternative)
- Attach documents to Employee, Asset, and Plant records
- View and download attached files
- Document reference table in the database

## Stage 4 — Staff Access (planned)

- Staff role login
- Restricted views: staff see only their own HR info
- Admin-controlled visibility for asset/plant data
- Permission enforcement throughout the app

## Stage 5 — WIP & Job Creation (planned)

- WIP tracker module
- Job creation module
- **Requires detailed business requirements before implementation**

## Stage 6 — Corrective Actions (planned)

- Corrective actions register
- Other compliance registers as needed

## Stage 7 — Reporting & Dashboards (planned)

- Advanced filtering and search
- Data export and reporting
- Accountability views

## Stage 8 — AI & Automation (planned)

- AI-assisted features
- Notifications
- Automated workflows

---

**Maintenance note:** Update this roadmap when stages are completed or plans change.
