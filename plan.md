# Training Page & Matrix View Redesign Plan

## Problem Summary
The page currently has 5 competing visual layers before you see employee data:
1. Page header
2. Compliance alert banners (red + amber + yellow)
3. Top-level tabs (Matrix / Roles / Skills / Accreditations)
4. Sub-view toggle (Employee Compliance / Tree)
5. Filter buttons (All / Expired / Missing / Expiring Soon / Compliant)

Each layer uses coloured pills/chips, creating visual noise. Employee cards are tall and contain per-accreditation status badges that are hard to scan.

---

## Plan

### 1. Training page outer shell (`page.tsx`)

**Remove** the compliance alert banners entirely. The Matrix view's own summary metrics will surface the same information more cleanly — no need for both.

**Tighten the header.** Keep the `<PageHeader>` but reduce bottom margin. The tabs sit directly below.

**Tabs stay unchanged** — Matrix / Roles / Skills / Accreditations, same underline style.

Result: Page goes Header → Tabs → Content, with no alert banners in between.

---

### 2. Matrix view — Summary metrics strip (`MatrixTab.tsx`)

Replace the old filter buttons with a **compact 4-card metrics row** at the top of the employee view:

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 24           │ 3            │ 5            │ 67%          │
│ Total        │ Expired      │ Missing /    │ Overall      │
│ Employees    │              │ Pending      │ Compliance   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

- **Total Employees** — grey/neutral, always shown
- **Expired** — red accent (count of employees with expired accreds)
- **Missing / Pending** — amber accent
- **Overall Compliance** — green if ≥90%, amber if 50–89%, red if <50%

Each card is clickable and acts as a **filter toggle** (click "Expired" to filter to just those employees; click again to reset to "All"). This eliminates the separate filter button row.

If there are issues (expired > 0 or missing > 0), a small **inline notice** appears below the metrics strip — a single subtle line like:
> "8 employees require attention" — not a full-width red banner.

---

### 3. Matrix view — Sub-view toggle

Replace the two pill-style buttons ("Employee Compliance" / "Role / Skill / Accreditation Tree") with a **minimal segmented control** aligned to the right of the metrics strip:

```
[Employee Compliance | Structure]
```

Compact, subtle, grey/blue toggle. Doesn't compete with the metrics.

---

### 4. Employee compliance list — Table layout

Replace the tall card-per-employee layout with a **compact table** inside a white rounded card:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Employee              Role(s)         Compliance    Issues            │
├────────────────────────────────────────────────────────────────────────┤
│ E001  John Smith      Crane Operator  ████████░░ 80%   1 expired     │
│ E002  Jane Doe        Site Manager    ██████████ 100%  —             │
│ E003  Bob Wilson      Rigger, Dogging ██░░░░░░░░ 20%   2 missing     │
│ ...                                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

Key changes:
- **Table header row** with column labels (subtle grey, uppercase, small)
- **Compact rows** — employee name, roles, thin compliance bar + percentage, and a single "issues" column
- The compliance bar is a **thin inline bar** (4px) integrated into the row, not a full-width element
- **Issues column** shows the most critical issue only: "2 expired" (red text) or "1 missing" (amber text) or a green checkmark/dash for compliant
- **No per-accreditation pills** in the list — those details belong in the click-through modal
- Rows are clickable (cursor-pointer, subtle hover)
- Employee number shown as grey monospace prefix before the name

**Sorting:** Default sort by compliance % ascending (worst first), so problems bubble to the top.

---

### 5. Colour system (restrained)

- **Blue** — active tab, active segmented control, interactive hover
- **Red** — expired counts, critical status (used sparingly — text colour or small dot, not big background fills)
- **Amber** — missing/pending/expiring soon
- **Green** — compliant bar colour, 100% badge
- **Grey** — borders, secondary text, inactive states, table structure

No coloured background fills on filter buttons or alert banners. Colour appears as:
- Bar fill colour
- Small text colour on issue counts
- Dot indicators (2px circles)

---

### 6. Modal — Minor polish only

The compliance edit modal works well and is already behind a click. Only minor tweaks:
- Match the updated colour system
- No structural changes

---

### 7. Tree view — Minor polish

- Tighten spacing slightly
- Match the card border/shadow treatment to the new style
- No structural changes

---

## What stays the same
- All existing functionality (filters, click-to-edit, compliance calculation, auto-expire)
- Tab names: Matrix, Roles, Skills, Accreditations
- The "Matrix" label
- Modal edit flow
- Tree view structure
- API layer — no backend changes

## Files changed
1. `src/app/(authenticated)/training/page.tsx` — remove alert banners, tighten spacing
2. `src/app/(authenticated)/training/components/MatrixTab.tsx` — metrics strip, segmented toggle, table layout
3. `src/app/(authenticated)/training/components/TrainingTabs.tsx` — minor spacing tweak (reduce mb-6 to mb-4)

## Questions for you

1. **Expiring Soon metric card** — I've proposed 4 cards (Total, Expired, Missing/Pending, Overall Compliance %). Should I add a 5th for "Expiring Soon" or keep that as a visible count only within the table rows? Adding a 5th card keeps it filterable from the top but makes the strip wider.

2. **Table vs compact cards** — I'm proposing a proper table layout (header row + data rows inside one card). Are you happy with that, or would you prefer keeping individual cards per employee but just making them much more compact (single-line height)?
