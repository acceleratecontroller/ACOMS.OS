# Decisions Log (legacy reference)

> Moved here as part of the docs reorganisation. Original: `docs/decisions.md`. Some decisions below have been superseded — see `../ARCHITECTURE.md` and `docs/system/AUTH_AND_PERMISSIONS.md` (in the Controller repo) for the current state.

---

This file records all architectural and business decisions made during development. Each decision includes the reasoning so it can be reviewed later.

---

## D1: Tech stack — Next.js + PostgreSQL + Prisma

**Date:** Stage 1
**Decision:** Use Next.js (App Router), PostgreSQL, Prisma, TypeScript, Tailwind CSS.
**Reason:** Next.js serves both frontend and backend from one codebase. PostgreSQL is industry-standard for structured business data. Prisma provides type-safe database access and readable schema files. TypeScript catches errors early. Tailwind keeps styling simple.

---

## D2: Single auth path — NextAuth.js only

**Date:** Stage 1
**Decision:** Use NextAuth.js (Auth.js v5) with Credentials provider. No Supabase Auth. No mixed auth approaches.
**Reason:** One auth system is simpler to maintain and debug. Supabase/Neon/Railway are used only as hosted PostgreSQL — not for auth features. NextAuth supports adding Google/Microsoft login later without changes.

> **2026 update:** This was superseded when ACOMS.Auth was built as a standalone OIDC provider. ACOMS.OS is now an OIDC client of ACOMS.Auth. Confirm whether the legacy credentials path is still reachable.

---

## D3: User and Employee are separate tables

**Date:** Stage 1
**Decision:** User (login account) and Employee (business record) are separate database tables with no required link between them.
**Reason:** Not every employee needs a system login. A User record is about system access. An Employee record is about the real person's business information. Mixing them would create confusion and unnecessary coupling.

> **2026 update:** Implementation has shifted — `Employee.identityId` now joins to ACOMS.Auth `Identity.id`. The local User model has been removed.

---

## D4: Assets and Plant assigned to Employee, not User

**Date:** Stage 1
**Decision:** The `assignedToId` field on Asset and Plant points to the Employee table, not the User table.
**Reason:** Assignment is a business concept — "this drill is assigned to John the employee", not "this drill is assigned to John's login account".

---

## D5: Asset vs Plant — separate tables

**Date:** Stage 1
**Decision:** Keep Asset and Plant as separate database tables and separate UI modules.
**Reason:**
- **Asset** = smaller, portable, or general company items (drills, tools, phones, laptops, PPE)
- **Plant** = larger operational equipment and machinery (cars, trucks, excavators, generators)
- They have different fields (Plant has registration number, service dates; Asset does not)
- They have different statuses (Asset: Available/In Use/Maintenance/Retired; Plant: Operational/Maintenance/Decommissioned/Standby)

---

## D6: Soft-delete from Stage 1

**Date:** Stage 1
**Decision:** All records use soft-delete (archive) from the beginning. No hard delete through the UI.

---

## D7: File provider abstraction

**Date:** Stage 1
**Decision:** Define a FileProvider interface now, but do not implement it until Stage 3.

---

## D8: API routes inside App Router

**Date:** Stage 1
**Decision:** All API routes live in `src/app/api/...` using Next.js App Router conventions (route.ts files). No separate `src/api/` folder.

---

## Assumptions

| # | Assumption | Impact |
|---|-----------|--------|
| A1 | Admin users log in with email + password (no SSO yet) | Superseded by ACOMS.Auth OIDC |
| A2 | Employee numbers are manually entered (e.g. "EMP-001") | Now auto-generated (E0001 format) |
| A3 | No file uploads in Stage 1 | Architecture is ready, implementation is not |
| A4 | App runs locally in Stage 1 (no cloud deployment yet) | Now deployed to Vercel |
| A5 | Asset and Plant categories are free text (not a predefined list yet) | Asset categories are now a tag table (commit `784eb3b`) |
