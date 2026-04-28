# Changelog — ACOMS.OS

> Format follows [Keep a Changelog](https://keepachangelog.com). Earlier history below is reconstructed from git log; treat anything before this file's creation as best-effort.

## [Unreleased]

### Added
- Architecture, audit, and next-actions documentation under `docs/`.
- Existing docs (`architecture.md`, `decisions.md`, `integrations.md`, `permissions.md`, `project-overview.md`, `roadmap.md`, `todo-extraction-guide.md`, `modules/*`) plus the two root plan files (`PLAN.md`, `plan.md`) moved to `docs/_reference/` to avoid mixing with the new docs.

### Changed
- (none)

### Fixed
- (none)

### Removed
- (none)

### Risks / Follow-up
- See `docs/AUDIT_LOG.md` for the live audit; `docs/NEXT_ACTIONS.md` for the prioritised queue.

---

## [Pre-doc baseline] — observable history from git, latest first

### 2026-04-28 — Audit / UI polish
- `961f7f25` Modal "last updated / created by" audit line added to plant, asset, and employee modals (the previous commit only put it on the dedicated detail-page routes).
- `784eb3b9` Asset category combobox + external-owner tagging. New `AssetCategory` and `AssetOwner` tables; migration backfills from existing free-text values. New `<TagComboBox>` shared component.

### 2026-04-23 — Training matrix overhaul
- `361de750` Calmer compliance modal — neutral row borders, status carried by dot + status word.
- `b9f820ea` Denser modal cards + Expand-all toggle.
- `71e618cd` Compliance modal redesign with collapsible row summaries and severity-aware auto-expand.
- `85d6500c` Structure view surfaces Required vs Other flags at every level.
- `991605b2` Required vs Other at the role→skill level (`RoleSkillLink.required`).
- `eab0ada5` Required/Other classification is skill-owned for linked rows. Hardened `scripts/migrate.sh` to abort on persistent migration failures (root cause of an earlier P2022 incident).
- `2e7666bd` Required vs Other accreditations + standalone adds; new `+ Add Accreditation` flow on the Employee compliance modal.
- `1020334e` Cleanup of orphaned PENDING/EXEMPT accreditations on link removal.
- `05b6cad1` Matrix search clarity (chips, blue banner) + group modal accreditations by skill.
- `ed164560` Matrix search input moved onto the segmented-control row.
- `a361c1e0` Region/depot toggle moved to a global, persistent control in the top header.
- `f52c9ca1` Renamed `EmployeeLocation` enum to `Location` and reused it on `Asset.location` and `Plant.location`. Migration converts existing strings to enum.

### 2026-04-22 — Bug fixes
- `4bd93ceb` Training tabs unlink fix — DELETE now sends ID via query param to match API.
- `6d947318` Backfill employee accreditations when role/skill requirements change (idempotent).

### 2026-04-14 — Audit fields
- `704da2f0` Added `updatedById` to Employee, Asset, Plant + migration. Detail pages show "Last updated [date] by [name] · Created [date] by [name]".

### 2026-04-08 → 2026-04-07 — Controller embed
- `1b5b715e` "Powered by ACOMS.Controller" subtitle on the Task Manager nav item.
- `423fdb1c` Eliminated double scrollbar on embedded task manager (fixed-position iframe).
- `ecfa995d` Made embedded task manager full-bleed; removed duplicate header.
- `dd826499` **Replaced legacy task manager with embedded ACOMS.Controller iframe.** Removed local Task / RecurringTask models, all task API routes, all task UI. Added embed-token issuance and `ControllerEmbed` component. New env var `NEXT_PUBLIC_ACOMS_CONTROLLER_URL`.
- `d8576c99` Clear asset location and `assignedTo` when unlinked from plant.
- `86b32d11` Lock asset location and `assignedTo` when linked to plant ("Managed by linked plant" hint in form, API strips fields).
- `20d5b529` Auto-set asset location to match plant location when linking (in addition to `assignedTo`).

---

## How to maintain this file

When you ship a change:
1. Add a one-sentence entry under `## [Unreleased]` in the right section (Added / Changed / Fixed / Removed / Risks).
2. Reference the commit SHA short-hash if useful.
3. When you cut a release, replace `[Unreleased]` with the version + date and start a fresh `## [Unreleased]` block.

Do not invent history. If unsure, write "(reason: unknown — see commit X)".
