# Permissions Model (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/permissions.md`. Current source of truth: `docs/system/AUTH_AND_PERMISSIONS.md` in the Controller repo.

---

## Overview

ACOMS.OS uses role-based access control (RBAC). Every user has a role that determines what they can see and do.

## Roles

| Role | Description | Implemented? |
|------|------------|-------------|
| **ADMIN** | Full access to all modules. Can create, read, update, and archive any record. | Yes (Stage 1) |
| **STAFF** | Limited access. Can view own HR info and admin-selected asset/plant data. | Partial (staff portal exists since 2026) |

## Permission matrix — Stage 1

| Action | ADMIN | STAFF (future) |
|--------|-------|---------------|
| View employee list | Yes | No (own record only) |
| Create employee | Yes | No |
| Edit employee | Yes | No |
| Archive employee | Yes | No |
| View asset list | Yes | View only (selected items) |
| Create asset | Yes | No |
| Edit asset | Yes | No |
| Archive asset | Yes | No |
| View plant list | Yes | View only (selected items) |
| Create plant | Yes | No |
| Edit plant | Yes | No |
| Archive plant | Yes | No |
| View archived records | Yes | No |
| Restore archived records | Yes | No |

## How it works technically

1. **User table** has a `role` field (enum: `ADMIN` or `STAFF`) — *now superseded by ACOMS.Auth `AppRole` lookup at login.*
2. **API routes** check the session role before allowing actions
3. **Auth helpers** (`requireAuth()`, `requireAdmin()`) are used in server components and API routes
4. Write operations (POST, PUT, DELETE) require `ADMIN` role
5. Read operations (GET) require authentication (any logged-in user)

## Stage 1 implementation

In Stage 1, only `ADMIN` users existed. The role check structure was in place, but `STAFF` restrictions were not enforced yet.

## Future plans (Stage 4)

- Staff users will see only their own Employee record
- Staff users will see a filtered view of assets and plant (admin-controlled)
- Admin users will control which assets/plant items are visible to staff
- All permission checks go through a central `authorize()` helper

> **2026 update:** A staff portal exists at `/staff/*` with its own API routes at `/api/staff/*`. See `O-009` in the audit log.
