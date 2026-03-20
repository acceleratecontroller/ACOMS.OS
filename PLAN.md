# Plan: Employee Login Access & Role-Based Restrictions

## Summary

Link employees to user accounts so admins can grant login access to employees. STAFF users see a restricted view: their own employee/training data, read-only assets & plant, no task manager or activity log.

---

## Part 1: Schema Changes

### 1a. Link Employee → User (optional)

Add an optional one-to-one relationship from Employee to User in `prisma/schema.prisma`:

```prisma
model Employee {
  // ... existing fields ...
  userId    String?  @unique
  user      User?    @relation("EmployeeUser", fields: [userId], references: [id])
}

model User {
  // ... existing fields ...
  employee  Employee? @relation("EmployeeUser")
}
```

- `userId` is optional — not every employee needs login access
- `@unique` enforces one-to-one (one user per employee)
- Existing admin users with no employee record continue to work normally

### 1b. Add `employeeId` to JWT session

Update `src/shared/auth/auth.ts` to include the linked `employeeId` in the session:

- In `authorize()`: query for `user.employee` and return `employeeId` if linked
- In JWT callback: store `employeeId` on the token
- In session callback: expose `employeeId` on `session.user`

Update `src/shared/auth/types.ts` to add `employeeId?: string` to the extended types.

### 1c. Generate and run migration

```
npx prisma migrate dev --name add-employee-user-link
```

---

## Part 2: API — Grant / Revoke Login Access

### 2a. New API route: `POST /api/employees/[id]/access`

**Grant access** — creates a User record linked to the employee:

Request body:
```json
{
  "email": "john@company.com",
  "password": "tempPassword123",
  "role": "STAFF"
}
```

Logic:
1. Verify caller is ADMIN
2. Verify employee exists and doesn't already have a linked user
3. Hash the password with bcryptjs
4. Create a User record with `isActive: true`
5. Update the Employee's `userId` field
6. Audit log the action
7. Return success

### 2b. New API route: `DELETE /api/employees/[id]/access`

**Revoke access** — deactivates (not deletes) the linked user:

Logic:
1. Verify caller is ADMIN
2. Find the linked User
3. Set `user.isActive = false` (blocks login without deleting audit trail)
4. Audit log the action

### 2c. New API route: `PUT /api/employees/[id]/access`

**Update access** — change role or reset password:

Request body (all optional):
```json
{
  "role": "ADMIN",
  "password": "newPassword",
  "isActive": true
}
```

---

## Part 3: Employee Detail Page — "Login Access" Section

### 3a. Add a section to `src/app/(authenticated)/employees/[id]/page.tsx`

At the bottom of the employee detail page, add a **Login Access** card:

**If no linked user:**
- Show "No login access" with a "Grant Access" button
- Clicking opens a small form: email, temporary password, role (ADMIN/STAFF dropdown)
- Submit calls `POST /api/employees/[id]/access`

**If linked user exists:**
- Show: email, role, active/inactive status
- "Revoke Access" button → calls `DELETE /api/employees/[id]/access`
- "Change Role" dropdown → calls `PUT /api/employees/[id]/access`
- "Reset Password" button → small form, calls `PUT /api/employees/[id]/access`

---

## Part 4: Role-Based Route Restrictions

### 4a. STAFF navigation — hide restricted items

Update `src/shared/components/Sidebar.tsx`:
- Make it async or pass session data to it
- Filter `navigationItems` based on role
- STAFF users do NOT see: "Task Manager", "Activity Log"
- STAFF users DO see: "Dashboard", "Employees" (own only), "Training", "Assets", "Plant"

Add a `roles` field to `NavItem` in `src/config/navigation.ts`:
```ts
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: ("ADMIN" | "STAFF")[]; // undefined = all roles
}
```

Items without `roles` show for everyone. Task Manager and Activity Log get `roles: ["ADMIN"]`.

### 4b. Middleware — block STAFF from restricted routes

Update `src/middleware.ts` to decode the JWT and check the role:
- STAFF users attempting `/tasks`, `/tasks/*`, `/activity-log`, `/activity-log/*` get redirected to `/`
- STAFF users attempting `/api/tasks/*` or `/api/activity-log/*` get a 403 response
- This is the hard gate — sidebar hiding is cosmetic, middleware is the real enforcement

### 4c. API-level guards — enforce read-only for STAFF

For assets and plant API routes (`/api/assets/*`, `/api/plant/*`):
- GET: allow all authenticated users (no change)
- POST, PUT, DELETE: return 403 if `session.user.role !== "ADMIN"`
- These routes already have this pattern for some write operations, but we'll make it consistent

### 4d. Employee API — STAFF sees own record only

Update `/api/employees/route.ts` (GET):
- If STAFF: return only the employee linked to `session.user.id` via `userId`
- If ADMIN: return all (no change)

Update `/api/employees/[id]/route.ts` (GET):
- If STAFF and `id !== session.user.employeeId`: return 403
- PUT/DELETE: return 403 for STAFF

### 4e. Training API — STAFF sees own training only

For training endpoints that return employee-specific data:
- `/api/training/employees/[employeeId]/accreditations` — STAFF can only access their own `employeeId`
- `/api/training/employees/[employeeId]/roles` — same restriction
- Training config (roles, skills, accreditations definitions) — read-only for STAFF
- Compliance summary / matrix: filter to own employee only for STAFF

### 4f. Dashboard — STAFF sees a simplified view

Update the dashboard page to check session role:
- STAFF: Show only their own employee info, their assigned training status, and general asset/plant counts
- Hide task summaries, activity feed, and alert items related to tasks
- This keeps the dashboard useful without exposing restricted data

---

## Part 5: Search — Respect Permissions

Update `/api/search/route.ts`:
- STAFF: exclude tasks and activity log results from search
- STAFF: exclude other employees from search results (only return own)

---

## File Change Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `userId` to Employee, `employee` to User |
| `src/shared/auth/auth.ts` | Include `employeeId` in JWT/session |
| `src/shared/auth/types.ts` | Add `employeeId` to type extensions |
| `src/app/api/employees/[id]/access/route.ts` | **New** — grant/revoke/update access |
| `src/app/(authenticated)/employees/[id]/page.tsx` | Add Login Access section |
| `src/config/navigation.ts` | Add `roles` field to NavItem |
| `src/shared/components/Sidebar.tsx` | Filter nav items by role |
| `src/middleware.ts` | Block STAFF from /tasks, /activity-log |
| `src/app/api/assets/route.ts` | Enforce write = ADMIN only |
| `src/app/api/assets/[id]/route.ts` | Enforce write = ADMIN only |
| `src/app/api/plant/route.ts` | Enforce write = ADMIN only |
| `src/app/api/plant/[id]/route.ts` | Enforce write = ADMIN only |
| `src/app/api/employees/route.ts` | STAFF sees own employee only |
| `src/app/api/employees/[id]/route.ts` | STAFF restricted to own record |
| `src/app/api/training/employees/[employeeId]/*` | STAFF restricted to own data |
| `src/app/api/training/compliance-summary/route.ts` | Filter for STAFF |
| `src/app/api/training/matrix/route.ts` | Filter for STAFF |
| `src/app/api/search/route.ts` | Exclude restricted results for STAFF |
| `src/app/(authenticated)/page.tsx` | Simplified dashboard for STAFF |

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
- Employee data model unchanged (except new optional `userId`)
- All existing functionality preserved for ADMIN role
- Audit logging continues to track all actions
- Login page unchanged — works for both ADMIN and STAFF users
