# Employee Register (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/modules/employee-register.md`. Some details below have changed (e.g. employee numbers are now auto-generated as E0001 format; the `User` table has been removed; the optional `identityId` joins to ACOMS.Auth).

---

## Purpose

The Employee Register is the central record of all company staff. It tracks who works for the company, their role, department, and employment status.

**Important distinction:** An Employee record is a business record about a real person. It is separate from the User table (which is about system login accounts). Not every employee needs a system login.

> **2026 update:** "User table" replaced by `Employee.identityId` linking to ACOMS.Auth.

## Key fields

| Field | Required? | Description |
|-------|-----------|------------|
| Employee Number | Yes | Unique company ID. Manually entered. *(2026: auto-generated E0001…)* |
| First Name | Yes | Employee's first name |
| Last Name | Yes | Employee's last name |
| Email | No | Work email address |
| Phone | No | Contact phone number |
| Position | Yes | Job title or role *(2026: replaced by EmployeeRole assignments — Training Roles)* |
| Department | No | Department name |
| Start Date | Yes | Date employment started |
| End Date | No | Date employment ended (blank if still employed) |
| Status | Yes | ACTIVE, INACTIVE, or TERMINATED |
| Notes | No | Free-text notes |

## Statuses

| Status | Meaning |
|--------|---------|
| **ACTIVE** | Currently employed |
| **INACTIVE** | Temporarily not active (e.g. leave) |
| **TERMINATED** | No longer employed |

## Permissions

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View list | Yes | Own record only |
| Create | Yes | No |
| Edit | Yes | No |
| Archive | Yes | No |

## Relationships

- **Assets** can be assigned to an Employee (see Asset Register)
- **Plant** can optionally be assigned to an Employee (see Plant Register)
- Each record tracks which **User** (login account) created it *(2026: tracks the Auth Identity UUID via `createdById`)*

## Future: file/document relationship

In Stage 3, documents will be attachable to employee records.

## Future: reporting needs

- List of all active employees by department
- Employee count by status
- Employees with upcoming end dates
- Assets assigned to each employee
- Employment history / status changes over time
