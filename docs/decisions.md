# Decisions Log

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

---

## D3: User and Employee are separate tables

**Date:** Stage 1
**Decision:** User (login account) and Employee (business record) are separate database tables with no required link between them.
**Reason:** Not every employee needs a system login. A User record is about system access. An Employee record is about the real person's business information. Mixing them would create confusion and unnecessary coupling.

---

## D4: Assets and Plant assigned to Employee, not User

**Date:** Stage 1
**Decision:** The `assignedToId` field on Asset and Plant points to the Employee table, not the User table.
**Reason:** Assignment is a business concept — "this drill is assigned to John the employee", not "this drill is assigned to John's login account". Since not all employees have logins, pointing to User would exclude employees without accounts.

---

## D5: Asset vs Plant — separate tables

**Date:** Stage 1
**Decision:** Keep Asset and Plant as separate database tables and separate UI modules.
**Reason:**
- **Asset** = smaller, portable, or general company items (drills, tools, phones, laptops, PPE)
- **Plant** = larger operational equipment and machinery (cars, trucks, excavators, generators)
- They have different fields (Plant has registration number, service dates; Asset does not)
- They have different statuses (Asset: Available/In Use/Maintenance/Retired; Plant: Operational/Maintenance/Decommissioned/Standby)
- Combining them would require constant conditional logic and create confusion
- See also: [asset-register.md](modules/asset-register.md) and [plant-register.md](modules/plant-register.md)

---

## D6: Soft-delete from Stage 1

**Date:** Stage 1
**Decision:** All records use soft-delete (archive) from the beginning. No hard delete through the UI.
**Reason:** Business records should never be permanently destroyed through normal operations. Archived records are hidden by default but can be viewed and restored by admins. This preserves audit history and prevents accidental data loss.

---

## D7: File provider abstraction

**Date:** Stage 1
**Decision:** Define a FileProvider interface now, but do not implement it until Stage 3.
**Reason:** SharePoint may be the first file storage backend, but we do not want to bake SharePoint into the core data model. The interface ensures any storage provider can be used. Stage 1 focuses on core registers; file attachments come later.

---

## D8: API routes inside App Router

**Date:** Stage 1
**Decision:** All API routes live in `src/app/api/...` using Next.js App Router conventions (route.ts files). No separate `src/api/` folder.
**Reason:** Next.js App Router is the standard pattern. Having API routes in the app directory keeps everything in one consistent structure and avoids confusion about where endpoints live.

---

## Assumptions

| # | Assumption | Impact |
|---|-----------|--------|
| A1 | Admin users log in with email + password (no SSO yet) | Keeps auth simple |
| A2 | Employee numbers are manually entered (e.g. "EMP-001") | Can add auto-generation later |
| A3 | No file uploads in Stage 1 | Architecture is ready, implementation is not |
| A4 | App runs locally in Stage 1 (no cloud deployment yet) | No hosting config needed |
| A5 | Asset and Plant categories are free text (not a predefined list yet) | Can add a categories table later |
