# ARCHITECTURE.md — ACOMS.OS

> Detailed architecture for the ACOMS.OS app.

For the cross-platform overview see `acceleratecontroller/ACOMS.Controller/docs/system/SYSTEM_OVERVIEW.md`.
For the legacy architecture / decisions / module write-ups see `docs/_reference/`.

---

## What this app is

ACOMS.OS is the **system of record for people and equipment**. It owns:

- Employees (with optional link to ACOMS.Auth `Identity`)
- Assets (smaller portable items)
- Asset Categories and Asset Owners (tag tables)
- Plant (larger operational equipment)
- Plant ↔ Asset links
- The Training Matrix (Roles, Skills, Accreditations, and the links between them)
- An Audit Log

It exposes a small read-only employee API for service-token use by ACOMS.WIP and ACOMS.Controller, and embeds ACOMS.Controller's task manager via an iframe.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | NextAuth v5 (beta) **as an OIDC client of ACOMS.Auth** (legacy credentials provider may still be present — see Risks) |
| Validation | Zod |
| Maps | Google Maps Places API (browser) |
| Deployment | Vercel |

---

## Folder structure (`src/`)

```
src/
├── app/
│   ├── (authenticated)/        Admin-facing pages (employees, assets, plant, training, activity-log, dashboard)
│   ├── (staff-portal)/         Staff self-service pages (e.g. /staff/training)
│   ├── api/                    Server route handlers (see below)
│   ├── login/                  Login page (triggers OIDC redirect)
│   ├── logout/                 Logout page
│   ├── layout.tsx              Root layout
│   └── globals.css
├── config/
│   ├── constants.ts            Option lists, labels, colour maps
│   └── navigation.ts           Sidebar items + role gating
├── modules/
│   ├── employees/              Zod schemas + business logic
│   ├── assets/
│   ├── plant/
│   └── training/
├── shared/
│   ├── api/helpers.ts          parseBody, validateEmployeeRef, withPrismaError
│   ├── audit/log.ts            audit() + diff() — fire-and-forget
│   ├── auth/
│   │   ├── auth.ts             NextAuth config
│   │   ├── service-token.ts    Bearer validation for SERVICE_TOKEN_ROUTES
│   │   └── types.ts            Session/JWT type extensions
│   ├── components/             Sidebar, GlobalSearch, DataTable, Modal, ConfirmDialog, FormField, PageHeader, StatusBadge, AddressAutocomplete, RegionFilterProvider, GlobalRegionToggle, TagComboBox, ControllerEmbed
│   ├── context/                React contexts (region filter, etc.)
│   ├── database/client.ts      Prisma singleton
│   ├── embed/token.ts          Sign + verify embed JWTs (for Controller iframe)
│   ├── file-provider/types.ts  FileProvider interface (placeholder for Stage 3)
│   └── date-utils.ts
└── middleware.ts               Edge-runtime auth gate
```

---

## API routes

```
src/app/api/
├── activity-log/      Paginated audit-log query (admin-only)
├── assets/            Asset CRUD + categories + owners endpoints
├── auth/[...nextauth] NextAuth handlers
├── embed-token/       Issue signed JWT for Controller iframe
├── employees/         Employee CRUD + access (grant / revoke login)
│   ├── assignees      Service-token-authenticated list of active employees
│   └── lookup         Service-token-authenticated single-employee lookup
├── plant/             Plant CRUD + plant-asset links
├── portals/           Portal-related endpoints (TBC: list of portals shown to user)
├── search/            Global search across entities
├── staff/             Staff portal API (read own training, etc.)
└── training/          Roles / Skills / Accreditations + employee assignments + matrix queries
```

Conventions:

- All mutations validate input with Zod (`parseBody`).
- All Prisma calls go through `withPrismaError` for consistent 404 / 409 / 400 responses.
- Mutations call `audit({ entityType, entityId, action, entityLabel, performedById, changes })` fire-and-forget. `performedById` is the **Auth Identity UUID** — there is no local User table.
- Soft-delete via `isArchived` + `archivedAt` + `archivedById`. List endpoints filter to non-archived by default.

---

## Database

Schema is in `prisma/schema.prisma`. Migrations are in `prisma/migrations/`. Build runs `sh scripts/migrate.sh && next build` — `migrate.sh` was hardened in commit `eab0ada5` to abort on persistent migration failures rather than silently shipping new code against an old schema.

Top-level models:

| Cluster | Models |
|---|---|
| Audit | `AuditLog` |
| Equipment | `Employee`, `Asset`, `AssetCategory`, `AssetOwner`, `Plant`, `PlantAssetLink` |
| Training | `TrainingRole`, `TrainingSkill`, `Accreditation`, `RoleSkillLink`, `SkillAccreditationLink`, `EmployeeRole`, `EmployeeAccreditation` |

Enums: `Role`, `EmployeeStatus`, `Location`, `RoleType`, `EmploymentType`, `AssetStatus`, `ItemCondition`, `PlantStatus`, `TrainingRoleCategory`, `AccreditationStatus`.

Notes:

- `Employee.identityId` is `String?` `@unique` — the join key to ACOMS.Auth. Not all employees have logins.
- `Location` is a shared enum used by Employee, Asset, and Plant (commit `f52c9ca1`).
- `Asset.categoryId` was migrated from a free-text `category` column to a tag table (commit `784eb3b`).
- `Asset.externallyOwned` + `externalOwnerId` — assets owned by a third party but possibly held by an employee (commit `784eb3b`).

The full data model is in `prisma/schema.prisma`. The cross-system view lives in `acoms.controller/docs/system/DATABASE_MAP.md`.

---

## Auth

**The README under the legacy `_reference/` folder describes a NextAuth credentials provider with `admin@acoms.local` as the seed user. The live middleware has been simplified to "no more 2FA logic, login pages, or TwoFactorGuard" and `.env.example` includes ACOMS.Auth OIDC client variables.** The current production login path is therefore expected to be:

1. Browser hits any protected route.
2. `src/middleware.ts` redirects to `/login` (no session cookie).
3. The login route initiates an OIDC flow against ACOMS.Auth using `ACOMS_AUTH_URL`, `ACOMS_AUTH_CLIENT_ID`, `ACOMS_AUTH_CLIENT_SECRET`.
4. After Auth login (incl. mandatory 2FA), Auth redirects back with a code; OS exchanges it for an ID token; OS creates a NextAuth session keyed on the Identity UUID + role.

**This needs human confirmation** — see `docs/AUDIT_LOG.md`.

### Middleware (`src/middleware.ts`)
- Public: `/api/auth`, `/login`, `/logout`, `/_next`, `/favicon.ico`.
- Service-token routes (bypass session check): `/api/employees/assignees`, `/api/employees/lookup`. The route handlers themselves validate the Bearer using `src/shared/auth/service-token.ts`.
- Admin-only routes (per code constants, but enforcement is in route handlers): `/tasks`, `/activity-log`, `/api/activity-log`.
- Staff API: `/api/staff/*` — accessible only by the logged-in staff member, enforced in route handlers.
- Default: redirect to `/login` if no session cookie.

### Granting / revoking employee logins (OS → Auth)
The Employee detail page exposes a *Login Access* card. The wiring is:

1. `POST /api/employees/[id]/access` (admin-only) creates an Identity in Auth via `ACOMS_AUTH_SERVICE_TOKEN`, then assigns a per-portal role via Auth's admin API, then writes the returned `Identity.id` to `Employee.identityId`.
2. `DELETE /api/employees/[id]/access` deactivates the Identity (`isActive = false`) without deleting it. Audit is preserved.
3. `PUT /api/employees/[id]/access` updates role or password.

Reference implementation: `acoms-os-integration/access-route.ts.reference` in the ACOMS.Auth repo.

---

## Environment variables

From `.env.example`:

```
DATABASE_URL                     pooled Neon URL for runtime
DIRECT_DATABASE_URL              direct Neon URL for prisma migrate
NEXTAUTH_SECRET                  legacy NextAuth secret (still required for sign/verify)
NEXTAUTH_URL                     local URL for callbacks
ACOMS_AUTH_URL                   Auth service base URL
ACOMS_AUTH_CLIENT_ID             "acoms-os"
ACOMS_AUTH_CLIENT_SECRET         OIDC client secret
ACOMS_AUTH_SERVICE_TOKEN         service token for calling Auth admin API
ACOMS_OS_SERVICE_TOKEN           OS's own service token; consumers (WIP, Controller) must match
NEXT_PUBLIC_ACOMS_CONTROLLER_URL Used in the iframe `src` for /tasks
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  Browser-exposed Maps API key
```

---

## External services

| Service | Purpose | Where |
|---|---|---|
| ACOMS.Auth | OIDC + admin REST API | `src/shared/auth/auth.ts`, employee `/access` route |
| ACOMS.Controller | Task manager iframe target | `src/shared/components/ControllerEmbed.tsx` (presumed name) |
| Google Maps Places | Address autocomplete | `src/shared/components/AddressAutocomplete.tsx` |

---

## Deployment

Vercel project. Build command: `npm run build` which is `sh scripts/migrate.sh && next build`. `migrate.sh` runs `prisma migrate deploy` with retry logic for Neon cold starts.

`postinstall` runs `prisma generate`.

---

## Cross-app dependencies

Outbound:
- ACOMS.Auth — OIDC for login, admin API for granting / revoking employee identities.
- ACOMS.Controller — iframe `src` target.
- (browser) Google Maps.

Inbound:
- ACOMS.WIP and ACOMS.Controller call `/api/employees/lookup` and `/api/employees/assignees` with the OS service token.

---

## Known architectural weaknesses

| # | Weakness | Severity | Notes |
|---|---|---|---|
| O1 | Legacy NextAuth credentials code may still be reachable | High | Confirm and remove. |
| O2 | `Employee.identityId` is not auto-cleared when Auth deactivates the identity | Medium | Document a runbook or add a webhook. |
| O3 | `audit()` is fire-and-forget — losses on process exit are silent | Low | Consider a small queue if audit fidelity matters. |
| O4 | No tests, no CI | High | Acknowledged in legacy roadmap. |
| O5 | Embed-token signing key may be `AUTH_SECRET` — single secret protects two boundaries | High | Confirm; if so, split into a dedicated env var. |
| O6 | `Employee` and `Asset` form fields use server-side Zod only — no client-side validation | Low | UX improvement. |
| O7 | Service-token comparison at `service-token.ts` should use constant-time compare | Medium | Confirm. |

The full register lives in `docs/AUDIT_LOG.md`.
