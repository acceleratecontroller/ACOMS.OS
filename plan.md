# Training Matrix — Implementation Plan

## Overview

New "Training" tab between Employees and Assets. Manages **Roles**, **Skills**, and **Accreditations** with linking between them and assignment to employees. Two view modes: Employee View (employee cards with their training info) and Matrix View (tree/hierarchy of role→skill→accreditation links).

---

## Phase 1: Database Schema

### New Prisma Models

**TrainingRole**
- `id` (UUID), `roleNumber` (unique, auto: `ROLE-0001`), `name`, `description?`, `category` (enum: OFFICE | FIELD)
- Standard audit fields: `createdAt`, `updatedAt`, `createdBy/Id`, `isArchived`, `archivedAt`, `archivedBy/Id`

**TrainingSkill**
- `id` (UUID), `skillNumber` (unique, auto: `SKILL-0001`), `name`, `description?`
- Standard audit fields

**Accreditation**
- `id` (UUID), `accreditationNumber` (unique, auto: `ACCR-0001`), `name`, `description?`
- Standard audit fields

**RoleSkillLink** (many-to-many: Role ↔ Skill)
- `id` (UUID), `roleId`, `skillId`
- `@@unique([roleId, skillId])`

**SkillAccreditationLink** (many-to-many: Skill ↔ Accreditation)
- `id` (UUID), `skillId`, `accreditationId`
- `@@unique([skillId, accreditationId])`

**EmployeeRole** (many-to-many: Employee ↔ Role)
- `id` (UUID), `employeeId`, `roleId`, `assignedAt` (DateTime)
- `@@unique([employeeId, roleId])`

**EmployeeAccreditation** (Employee's actual accreditations)
- `id` (UUID), `employeeId`, `accreditationId`
- `issueDate?` (DateTime), `expiryDate?` (DateTime), `certificateNumber?` (String)
- `notes?` (String)
- `@@unique([employeeId, accreditationId])`

### New Enums
- `TrainingRoleCategory`: `OFFICE`, `FIELD`

### Migration
- Run `npx prisma migrate dev --name add-training-matrix`

---

## Phase 2: API Routes

All routes follow existing patterns (auth check, Zod validation, `withPrismaError`, audit logging).

### CRUD Routes

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/training/roles` | GET, POST | List/create roles. GET supports `?archived=true` |
| `/api/training/roles/[id]` | GET, PUT | Get/update single role |
| `/api/training/roles/[id]/archive` | POST | Archive role |
| `/api/training/roles/[id]/restore` | POST | Restore role |
| `/api/training/skills` | GET, POST | List/create skills |
| `/api/training/skills/[id]` | GET, PUT | Get/update single skill |
| `/api/training/skills/[id]/archive` | POST | Archive skill |
| `/api/training/skills/[id]/restore` | POST | Restore skill |
| `/api/training/accreditations` | GET, POST | List/create accreditations |
| `/api/training/accreditations/[id]` | GET, PUT | Get/update single accreditation |
| `/api/training/accreditations/[id]/archive` | POST | Archive accreditation |
| `/api/training/accreditations/[id]/restore` | POST | Restore accreditation |

### Linking Routes

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/training/roles/[id]/skills` | GET, POST, DELETE | Link/unlink skills to a role |
| `/api/training/skills/[id]/accreditations` | GET, POST, DELETE | Link/unlink accreditations to a skill |

### Employee Assignment Routes

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/training/employees/[employeeId]/roles` | GET, POST, DELETE | Assign/remove roles for an employee. **POST triggers auto-assign**: when a role is assigned, all accreditations linked via role→skill→accreditation are automatically added to the employee's accreditations (if not already present), with no expiry date (to be filled in manually). |
| `/api/training/employees/[employeeId]/accreditations` | GET, POST, PUT, DELETE | Manage employee accreditations directly (for updating expiry dates, adding standalone accreditations not linked to any skill, etc.) |

### Summary/Matrix Route

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/training/matrix` | GET | Returns full role→skill→accreditation tree structure for the matrix view |
| `/api/training/employees/summary` | GET | Returns all employees with their roles, skills, accreditations, and compliance status |

---

## Phase 3: Validation Schemas

File: `src/modules/training/validation.ts`

- `createRoleSchema`: name (required), description (optional), category (enum OFFICE/FIELD)
- `updateRoleSchema`: partial of create
- `createSkillSchema`: name (required), description (optional)
- `updateSkillSchema`: partial of create
- `createAccreditationSchema`: name (required), description (optional)
- `updateAccreditationSchema`: partial of create
- `assignEmployeeAccreditationSchema`: accreditationId (required), issueDate (optional), expiryDate (optional), certificateNumber (optional), notes (optional)
- `updateEmployeeAccreditationSchema`: partial of assign (minus accreditationId)

---

## Phase 4: Navigation

Update `src/config/navigation.ts` to add Training tab between Employees and Assets:
```
{ label: "Training", href: "/training", icon: "T" }
```

---

## Phase 5: Frontend — Training Page

File: `src/app/(authenticated)/training/page.tsx`

### Top Section — Action Buttons
Three buttons at the top:
- **+ New Role** → opens create role modal
- **+ New Skill** → opens create skill modal
- **+ New Accreditation** → opens create accreditation modal

### View Toggle
Toggle button/tabs to switch between two views:
1. **Employee View** (default)
2. **Matrix View**

---

### Employee View

Similar layout to the Employees tab but focused on training data.

**DataTable columns:**
- Employee # | Name | Roles | Skills | Accreditations | Compliance Status

**Compliance Status logic:**
- For each employee, look at their assigned roles → what skills those roles require → what accreditations those skills require
- Compare required accreditations vs actual employee accreditations
- **Compliant** (green): All required accreditations present and not expired
- **Expiring Soon** (yellow): All present but one or more expires within 30 days
- **Non-Compliant** (red): Missing accreditations or one or more expired

**Row click** opens a detail modal showing:
- Employee name and number
- Assigned roles (listed as badges)
- Required accreditations (from role→skill→accreditation links) with status indicators:
  - Green check: has it, not expired
  - Yellow warning: has it, expiring within 30 days
  - Red X: missing or expired
- Extra accreditations (ones they have that aren't required by any role)
- Each accreditation shows: name, certificate number, issue date, expiry date

**From this modal you can:**
- Assign/remove roles (dropdown + add button)
- Add/edit/remove accreditations (with expiry date, certificate number fields)

---

### Matrix View

Tree/hierarchy display showing the full role→skill→accreditation structure.

**Layout:**
- Each **Role** is an expandable card/section (click to expand/collapse)
  - Shows role name, category badge (Office/Field), description
  - Inside: list of linked **Skills**
    - Each skill shows its name and description
    - Under each skill: linked **Accreditations** shown as badges/chips
- Below the role tree: a section for **Unlinked Accreditations** (accreditations not linked to any skill)
- Below that: **Unlinked Skills** (skills not linked to any role)

**Each item is clickable** to open an edit modal where you can:
- Edit the role/skill/accreditation details
- Manage links (add/remove skills from a role, add/remove accreditations from a skill)
- Archive the item

---

## Phase 6: Constants

Add to `src/config/constants.ts`:
- `TRAINING_ROLE_CATEGORY_OPTIONS`: `[{ value: "OFFICE", label: "Office" }, { value: "FIELD", label: "Field" }]`

---

## Phase 7: Audit Logging

All create/update/archive/restore operations on roles, skills, accreditations, and employee assignments get logged via the existing `audit()` function with:
- `entityType`: "TrainingRole", "TrainingSkill", "Accreditation", "EmployeeAccreditation", "EmployeeRole"
- Standard action types: CREATE, UPDATE, ARCHIVE, RESTORE

---

## Implementation Order

1. **Schema + Migration** — Prisma models, enums, relations, migrate
2. **Validation** — Zod schemas for all entities
3. **API Routes** — CRUD for roles, skills, accreditations, then linking routes, then employee assignment routes, then summary/matrix routes
4. **Constants + Navigation** — Add constants and nav tab
5. **Frontend — Shell** — Page skeleton with view toggle, action buttons, empty states
6. **Frontend — Create/Edit Modals** — Forms for roles, skills, accreditations
7. **Frontend — Matrix View** — Tree/hierarchy display with link management
8. **Frontend — Employee View** — Employee list with compliance status, detail modal with role/accreditation management
9. **Expiry Warnings** — Visual indicators for expiring/expired accreditations in both views

---

## Things Worth Noting

- **Auto-assign behavior**: When a role is assigned to an employee, all accreditations linked through that role's skills are automatically added to the employee with blank expiry dates. The admin then needs to fill in the actual expiry dates. This means the compliance status would show these as "present but no expiry set" — treated as compliant (since the accreditation exists, just needs date updating).
- **Standalone accreditations**: An employee can have accreditations not linked to any skill/role. These show separately in the employee detail view as "Additional Accreditations".
- **Removing a role**: When a role is removed from an employee, the auto-assigned accreditations are NOT automatically removed (since the employee still holds those accreditations in reality). Only manual removal deletes them.
- **Archive cascading**: Archiving a role/skill/accreditation doesn't delete links — it just hides the item from active lists. Links remain so data isn't lost.
