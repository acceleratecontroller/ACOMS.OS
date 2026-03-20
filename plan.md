# Plan: Employee Compliance Management & Accreditation Expiry Settings

## Problem

1. **No way to update employee compliance** — The employee compliance view is read-only. You can see that someone is non-compliant, but there's no way to mark an accreditation as verified, set expiry dates, or manage it per-employee.

2. **Accreditations lack expiry/renewal metadata** — When creating an accreditation (e.g. "White Card"), there's no way to specify whether it expires or how often it needs renewal. This should live on the accreditation definition itself, not just per-employee.

---

## Part 1: Accreditation Expiry & Renewal Fields

### Schema Changes (Prisma)

Add three fields to the `Accreditation` model:

```
expires        Boolean   @default(false)   // Does this accreditation expire?
renewalMonths  Int?                        // How often (months) renewal is needed (12, 24, 36, etc.)
renewalNotes   String?                     // E.g. "Must complete refresher course"
```

**Migration**: `20260320120000_add_accreditation_expiry_fields` — all columns nullable/defaulted, no breaking changes.

### Validation Changes

Update `createAccreditationSchema` and `updateAccreditationSchema` to include:
- `expires`: boolean (default false)
- `renewalMonths`: optional positive integer
- `renewalNotes`: optional string

### API Changes

Update `POST /api/training/accreditations` and `PUT /api/training/accreditations/[id]` to persist the new fields.

### UI Changes (AccreditationsTab)

Update the create/edit forms in AccreditationsTab to add:
- **"Has Expiry" checkbox** — when checked, reveals:
  - **"Renewal Period"** dropdown (6, 12, 24, 36, 60 months)
  - **"Renewal Notes"** text field
- Show expiry info in the view mode and table

---

## Part 2: Employee Compliance Popup (MatrixTab)

### What it does

Clicking an employee card in the **Employee Compliance** view opens a modal showing all their required accreditations with inline editing.

### Modal Layout

```
┌─────────────────────────────────────────────────────┐
│  John Smith (E0001)                    75% compliant │
│  Roles: Site Supervisor, Crane Operator              │
│─────────────────────────────────────────────────────│
│                                                      │
│  ACCREDITATION         STATUS        EXPIRY   CERT#  │
│  ─────────────────────────────────────────────────── │
│  White Card            [VERIFIED ▾]  2027-03  WC123  │
│  Working at Heights    [PENDING  ▾]  ________  ____  │
│  First Aid             [MISSING  ▾]  ________  ____  │
│  Crane Licence         [EXEMPT   ▾]  ________  ____  │
│                                                      │
│  Notes: ________________________________________     │
│                                                      │
│                              [ Save All Changes ]    │
└─────────────────────────────────────────────────────┘
```

Each accreditation row has:
- **Accreditation name** (read-only) + whether it expires + renewal period info
- **Status dropdown** — PENDING / VERIFIED / EXPIRED / EXEMPT (for MISSING ones, selecting any status auto-creates the EmployeeAccreditation record)
- **Expiry Date** — date picker, only shown when the accreditation definition has `expires=true`
- **Certificate Number** — optional text field
- **Notes** — optional text field (per accreditation)

### API Usage

No new API endpoints needed:
- Employee data comes from existing `GET /api/training/matrix?view=employees`
- Status updates use existing `PUT /api/training/employees/[employeeId]/accreditations/[id]`
- Creating MISSING records uses existing `POST /api/training/employees/[employeeId]/accreditations`

### Matrix API Tweak

Update `GET /api/training/matrix?view=employees` to include the accreditation definition's `expires` and `renewalMonths` fields in the nested accreditation data, so the modal knows whether to show a date picker.

### MatrixTab UI Changes

- Make each employee card **clickable** (add hover state + cursor-pointer)
- Add a `Modal` component import and state management for the selected employee
- Inside the modal: table of accreditations with inline edit fields
- "Save All Changes" button that batches PUT/POST calls for each changed accreditation
- After saving, refresh the employee list to update compliance percentages

---

## File Change Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `expires`, `renewalMonths`, `renewalNotes` to Accreditation |
| `prisma/migrations/20260320120000_...` | New migration for 3 columns |
| `src/modules/training/validation.ts` | Add new fields to accreditation schemas |
| `src/app/api/training/accreditations/route.ts` | Handle new fields in POST |
| `src/app/api/training/accreditations/[id]/route.ts` | Handle new fields in PUT/GET |
| `src/app/api/training/matrix/route.ts` | Include `expires`, `renewalMonths` in employee view accreditation data |
| `src/app/(authenticated)/training/components/AccreditationsTab.tsx` | Add expiry toggle + renewal fields to forms |
| `src/app/(authenticated)/training/components/MatrixTab.tsx` | Add clickable employee cards + compliance management modal |

**No new files needed** — all changes are to existing files.

---

## Implementation Order

1. Schema + migration (Accreditation expiry fields)
2. Validation schema updates
3. Accreditation API updates (create/update with new fields)
4. AccreditationsTab UI (expiry toggle in create/edit forms)
5. Matrix API tweak (include expiry metadata in employee view)
6. MatrixTab compliance modal (the main feature — clickable employee → edit accreditations)
7. TypeScript check + commit + push

---

## Notes

- **No breaking changes** — new fields all have defaults, existing data unaffected
- **Reuses existing endpoints** — the PUT for employee accreditations already supports all the fields we need
- **MISSING → created on save** — if an accreditation shows as MISSING and the admin changes its status, we POST to create it then
- **Accreditation expiry is informational** — it tells the admin "this needs renewing every X months" but doesn't auto-expire records. Auto-expiry could be added later
