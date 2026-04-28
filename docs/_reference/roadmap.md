# Roadmap (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/roadmap.md`. Current state lives in `../NEXT_ACTIONS.md`.

---

## Stage overview

| Stage | Name | Status | What it delivers |
|-------|------|--------|-----------------|
| 1 | Foundation + Core Registers | **Complete** | Project setup, Employee/Asset/Plant registers, Task Manager, Activity Log, Dashboard, admin auth, documentation |
| 2 | Enrichment | Planned | Pagination, sorting, data export, status workflow refinements |
| 3 | File Integration | Planned | File provider implementation, attach documents to records |
| 4 | Staff Access | Partial | Staff portal exists at `/staff/*` since 2026 |
| 5 | WIP & Job Creation | Done — split into separate apps (ACOMS.WIP and ACOMS.Controller's Job Creator) |
| 6 | Corrective Actions | Planned | Corrective actions register, compliance registers |
| 7 | Reporting & Dashboards | Planned | Advanced filtering, exporting, summary views |
| 8 | AI & Automation | Planned | AI-assisted features, notifications, automated workflows |

## Stage 1 — Foundation + Core Registers (complete)

### Known limitations (to address in later stages)

- No tests or CI/CD
- No pagination on list endpoints (except activity log)
- No client-side form validation
- No rate limiting
- No field-level access control
- File attachments not implemented

> **2026 update:** Tasks were extracted to ACOMS.Controller (commit `dd826499`). Training Matrix module was added (Roles / Skills / Accreditations + assignment to employees). Region/depot global filter added.

## Stage 4 — Staff Access (partial)

- Staff role login — implemented via ACOMS.Auth
- Restricted views: staff see only their own HR info — partial
- Admin-controlled visibility for asset/plant data — not yet
- Permission enforcement throughout the app — partial

## Stage 5 — WIP & Job Creation (built as separate apps)

- ACOMS.WIP — built. Project lifecycle (quote → as-built → invoiced).
- Job Creator inside ACOMS.Controller — built.

## Remaining stages (6, 7, 8)

Treat these as aspirational. Pull from `../NEXT_ACTIONS.md` for the live queue.
