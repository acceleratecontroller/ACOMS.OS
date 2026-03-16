# Roadmap

## Stage overview

| Stage | Name | Status | What it delivers |
|-------|------|--------|-----------------|
| 1 | Foundation + Core Registers | **In Progress** | Project setup, Employee/Asset/Plant registers, admin auth, documentation |
| 2 | Enrichment | Planned | Search/filter, status workflows, audit trail (who changed what) |
| 3 | File Integration | Planned | File provider implementation, attach documents to records |
| 4 | Staff Access | Planned | Staff logins, restricted views, permission enforcement |
| 5 | WIP & Job Creation | Planned | WIP tracker, job creation (requires business requirements) |
| 6 | Corrective Actions | Planned | Corrective actions register, compliance registers |
| 7 | Reporting & Dashboards | Planned | Filtering, exporting, summary views |
| 8 | AI & Automation | Planned | AI-assisted features, notifications, automated workflows |

## Stage 1 — Foundation + Core Registers

### What is finished

- [x] Next.js project with TypeScript and Tailwind CSS
- [x] PostgreSQL database schema (Prisma)
- [x] User table for authentication (separate from Employee)
- [x] Employee Register — list, create, view, edit, archive
- [x] Asset Register — list, create, view, edit, archive
- [x] Plant Register — list, create, view, edit, archive
- [x] Admin authentication with NextAuth.js
- [x] Soft-delete/archive on all records
- [x] File provider interface (placeholder only)
- [x] Sidebar navigation
- [x] All documentation files

### What is not finished

- [ ] Database migrations (need a live PostgreSQL database to run)
- [ ] Seed script execution (needs live database)
- [ ] Search and filtering on list pages
- [ ] Audit trail (who changed what, when)
- [ ] File attachments
- [ ] Staff login role

### What comes next

Stage 2: Enrichment — adding search/filter to lists, audit trail, and status workflow refinements.

## Stage 2 — Enrichment (planned)

- Search and filter on all list views
- Sorting by column
- Audit trail: track who changed each record and when
- Status workflow refinements
- Pagination for large lists
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

- Dashboard with summary statistics
- Advanced filtering and search
- Data export and reporting
- Accountability views

## Stage 8 — AI & Automation (planned)

- AI-assisted features
- Notifications
- Automated workflows
