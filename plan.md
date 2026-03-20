# Plan: Fix Expiry-Based Compliance Logic

## Problem

Compliance is currently based solely on the `status` field (VERIFIED/EXEMPT = compliant). This means:
- An employee with a **VERIFIED** accreditation whose **expiry date has passed** still shows as compliant
- There's no visibility into expired or soon-to-expire accreditations on the dashboard or training page
- The `renewalMonths` field is being treated as a tracking mechanism, but it should be **informational only** — a driver's licence might say "renew every 5 years" but someone could do a 3-year renewal

**The individual `expiryDate` on each EmployeeAccreditation is the single source of truth for compliance.**

---

## Step 1: Fix `computeCompliance()` in MatrixTab.tsx

Update the compliance function to check `expiryDate` in addition to `status`:

| Status | expiryDate | Result |
|--------|-----------|--------|
| VERIFIED | in the past | **Not compliant** (effectively expired) |
| VERIFIED | in the future / null | Compliant |
| EXEMPT | any | Always compliant |
| PENDING / EXPIRED / MISSING | any | Not compliant |

Also compute:
- `expiredCount` — how many accreditations have passed their expiry date
- `expiringSoonCount` — how many expire within 30 days

**File:** `src/app/(authenticated)/training/components/MatrixTab.tsx`

---

## Step 2: Visual indicators in Employee Compliance cards + Modal

**Employee cards** (compliance view):
- Red badge: "X expired" when any accreditation has a past expiry date
- Amber badge: "X expiring soon" when any expire within 30 days
- Individual accreditation status chips reflect date-based expiry (override VERIFIED → show as expired if date has passed)

**ComplianceModal** (employee detail popup):
- If VERIFIED but expiryDate < today → red warning: "Expired on [date] — update status"
- If expiryDate within 30 days → amber warning: "Expires in X days"
- Visual-only — admin still updates status/date manually

**File:** `src/app/(authenticated)/training/components/MatrixTab.tsx`

---

## Step 3: Add expiry alert banner to the Training page

Add a summary banner above the tabs on the training page:
- Red: "X employees have expired accreditations"
- Amber: "X employees have accreditations expiring within 30 days"
- Clicking either switches to the Matrix tab (employee compliance view)

New API endpoint: **`GET /api/training/compliance-summary`** returns:
```json
{ "expired": 3, "expiringSoon": 5 }
```

Server-side query checks `EmployeeAccreditation.expiryDate` against today's date for active, non-archived employees with `expires=true` accreditations. This avoids loading the full matrix client-side just for counts.

**Files:**
- `src/app/api/training/compliance-summary/route.ts` (new)
- `src/app/(authenticated)/training/page.tsx`

---

## Step 4: Add expiry alerts to the Dashboard (cover page)

Add a "Training Compliance" section to the main dashboard, following the existing alert pattern (similar to overdue tasks / plant service alerts):
- Red alert: "X employees have expired accreditations"
- Amber alert: "X accreditations expiring within 30 days"
- Both link to `/training`

Reuses the same `/api/training/compliance-summary` endpoint from Step 3.

**File:** `src/app/(authenticated)/page.tsx`

---

## What does NOT change

- **No schema changes** — `expiryDate` already exists on EmployeeAccreditation
- **`renewalMonths` stays as-is** — informational FYI on the accreditation definition, not used for compliance calculations
- **No auto-status updates** — admins manage statuses manually; the system just surfaces warnings
- **No auto-renewal** — the system never auto-calculates expiry dates from renewalMonths

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/app/(authenticated)/training/components/MatrixTab.tsx` | Fix compliance logic, add expiry badges, modal warnings (Steps 1, 2, 5) |
| `src/app/api/training/compliance-summary/route.ts` | **New** — lightweight endpoint for expired/expiring counts (Step 3) |
| `src/app/(authenticated)/training/page.tsx` | Add expiry alert banner above tabs (Step 3) |
| `src/app/(authenticated)/page.tsx` | Add training compliance alerts to dashboard (Step 4) |

## Implementation Order

1. Fix `computeCompliance()` + employee card badges (Steps 1-2)
2. Update ComplianceModal with expiry warnings (Step 2 cont.)
3. Create compliance-summary API endpoint (Step 3)
4. Add training page alert banner (Step 3)
5. Add dashboard alerts (Step 4)
6. TypeScript check + commit + push
