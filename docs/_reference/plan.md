# Training Page & Matrix View Redesign Plan (legacy reference)

> Moved here as part of the docs reorganisation. Original: repo root `plan.md`. Largely executed in the April 2026 training-matrix overhaul (commits `361de750`, `b9f820ea`, `71e618cd`, `85d6500c`, `991605b2`, `eab0ada5`, `2e7666bd`, `1020334e`, `05b6cad1`, `ed164560`, `a361c1e0`, `f52c9ca1`).

---

## Problem Summary

The page currently has 5 competing visual layers before you see employee data:
1. Page header
2. Compliance alert banners (red + amber + yellow)
3. Top-level tabs (Matrix / Roles / Skills / Accreditations)
4. Sub-view toggle (Employee Compliance / Tree)
5. Filter buttons (All / Expired / Missing / Expiring Soon / Compliant)

Each layer uses coloured pills/chips, creating visual noise.

---

## Plan

### 1. Training page outer shell
Remove the compliance alert banners. Tighten header. Tabs unchanged.

### 2. Matrix view — Summary metrics strip
Replace filter buttons with a 4-card metrics row: Total / Expired / Missing+Pending / Overall Compliance. Each clickable as a filter toggle.

### 3. Matrix view — Sub-view toggle
Replace pill buttons with a minimal segmented control (Employee Compliance / Structure).

### 4. Employee compliance list — Table layout
Replace tall card-per-employee layout with a compact table. Sort worst-first by default. Compliance bar inline.

### 5. Colour system (restrained)
Blue = active; Red = expired; Amber = missing/pending; Green = compliant; Grey = structure.

### 6. Modal — minor polish only
### 7. Tree view — minor polish

---

## Files changed
1. `src/app/(authenticated)/training/page.tsx`
2. `src/app/(authenticated)/training/components/MatrixTab.tsx`
3. `src/app/(authenticated)/training/components/TrainingTabs.tsx`

---

## Open questions (now answered by the executed work)

1. Add a 5th metric card for "Expiring Soon"? — Resolved during implementation.
2. Table vs compact cards? — Table.

> **2026 status:** Implemented and iterated through several design passes (see CHANGELOG entries 2026-04-23). This plan is preserved for historical context only.
