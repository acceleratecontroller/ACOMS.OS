# Plan: Employee Login Access & Role-Based Restrictions (legacy reference)

> Moved here as part of the docs reorganisation. Original: repo root `PLAN.md`. The plan below is the original "give STAFF users restricted access" design from before ACOMS.Auth was built — large parts have since been superseded by SSO via ACOMS.Auth and the `(staff-portal)` route group.

---

## Summary

Link employees to user accounts so admins can grant login access to employees. STAFF users see a restricted view: their own employee/training data, read-only assets & plant, no task manager or activity log.

---

## Part 1: Schema Changes

### 1a. Link Employee → User (optional)

Add an optional one-to-one relationship from Employee to User in `prisma/schema.prisma`.

> **2026 update:** Implemented as `Employee.identityId` joining to ACOMS.Auth `Identity` (UUID), not a local User table.

### 1b. Add `employeeId` to JWT session

Update `src/shared/auth/auth.ts` to include the linked `employeeId` in the session.

### 1c. Generate and run migration

```
npx prisma migrate dev --name add-employee-user-link
```

---

## Part 2: API — Grant / Revoke Login Access

### 2a. New API route: `POST /api/employees/[id]/access`

**Grant access** — creates a User record linked to the employee:

> **2026 update:** Implemented; calls ACOMS.Auth admin API instead of creating a local User.

### 2b. New API route: `DELETE /api/employees/[id]/access`

**Revoke access** — deactivates the linked user.

### 2c. New API route: `PUT /api/employees/[id]/access`

**Update access** — change role or reset password.

---

## Part 3: Employee Detail Page — "Login Access" Section

Add a Login Access card to `src/app/(authenticated)/employees/[id]/page.tsx`.

**If no linked user:** "No login access" + Grant Access button.
**If linked user exists:** show email, role, active state; revoke / change role / reset password actions.

---

## Part 4: Role-Based Route Restrictions

### 4a. STAFF navigation — hide restricted items
### 4b. Middleware — block STAFF from `/tasks`, `/activity-log`
### 4c. API-level guards — enforce read-only for STAFF on assets/plant
### 4d. Employee API — STAFF sees own record only
### 4e. Training API — STAFF sees own training only
### 4f. Dashboard — simplified view for STAFF

---

## Part 5: Search — Respect Permissions

STAFF: exclude tasks and activity log results from search; only return own employee.

---

## File Change Summary

(Summary table omitted in this archive — see git history for the full list.)

---

## Implementation Order

1. Schema + migration (Part 1)
2. Auth session changes (Part 1b)
3. Grant/revoke API (Part 2)
4. Employee detail page UI (Part 3)
5. Navigation filtering (Part 4a)
6. Middleware route blocking (Part 4b)
7. API-level guards for all routes (Parts 4c–4e)
8. Dashboard adjustments (Part 4f)
9. Search filtering (Part 5)

---

## What stays the same

- Existing ADMIN users continue to work with full access
- Audit logging continues to track all actions
- Login page unchanged — works for both ADMIN and STAFF users

> **2026 status:** Largely executed; some pieces (e.g. Part 5 search filtering, Part 4f dashboard scope) need a code-review confirmation. See `O-009` and `O-020` in `../AUDIT_LOG.md`.
