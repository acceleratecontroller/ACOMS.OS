# Architecture

## Overview

ACOMS.OS is a Next.js application using the App Router pattern. It serves both the frontend (web pages) and backend (API endpoints) from a single codebase.

## Folder structure

```
ACOMS.OS/
├── docs/                              Documentation files
├── prisma/
│   ├── schema.prisma                  Database schema (source of truth)
│   └── seed.ts                        Creates initial admin user
├── src/
│   ├── app/                           Next.js App Router
│   │   ├── layout.tsx                 Main app shell (sidebar + content)
│   │   ├── page.tsx                   Dashboard home page
│   │   ├── login/page.tsx             Login page
│   │   ├── employees/                 Employee register pages
│   │   │   ├── page.tsx               List view
│   │   │   ├── new/page.tsx           Create form
│   │   │   └── [id]/page.tsx          View/edit single record
│   │   ├── assets/                    Asset register pages (same pattern)
│   │   ├── plant/                     Plant register pages (same pattern)
│   │   └── api/                       Backend API routes
│   │       ├── auth/[...nextauth]/    Authentication endpoint
│   │       ├── employees/             Employee CRUD API
│   │       ├── assets/                Asset CRUD API
│   │       └── plant/                 Plant CRUD API
│   ├── modules/                       Module-specific business logic
│   │   ├── employees/validation.ts    Employee validation rules
│   │   ├── assets/validation.ts       Asset validation rules
│   │   └── plant/validation.ts        Plant validation rules
│   ├── shared/                        Reusable code across modules
│   │   ├── auth/                      Auth config, helpers, type extensions
│   │   ├── components/                Shared UI: Sidebar, DataTable, FormField, etc.
│   │   ├── database/client.ts         Prisma database client
│   │   └── file-provider/             File storage abstraction (placeholder)
│   └── config/
│       └── navigation.ts             Sidebar navigation config
├── .env.example                       Environment variable template
├── package.json                       Dependencies and scripts
└── tsconfig.json                      TypeScript configuration
```

## Key patterns

### Each module follows the same structure

Every register (employees, assets, plant) has:
- **Pages** in `src/app/[module]/` — list, create, view/edit
- **API routes** in `src/app/api/[module]/` — GET, POST, PUT, DELETE
- **Validation** in `src/modules/[module]/validation.ts` — Zod schemas
- **Documentation** in `docs/modules/[module].md`

### Adding a new module

To add a new register (e.g. "Corrective Actions"):
1. Add a Prisma model to `prisma/schema.prisma`
2. Create pages in `src/app/corrective-actions/`
3. Create API routes in `src/app/api/corrective-actions/`
4. Create validation in `src/modules/corrective-actions/`
5. Add a nav item in `src/config/navigation.ts`
6. Add documentation in `docs/modules/`

Nothing existing needs to change.

### Database

- **PostgreSQL** is the database
- **Prisma** manages the schema and provides type-safe queries
- The schema is defined in `prisma/schema.prisma`
- Migrations are tracked in `prisma/migrations/`

### Authentication

- **NextAuth.js (Auth.js v5)** handles login/sessions
- Credentials provider: email + password
- Passwords hashed with bcrypt
- JWT-based sessions
- Role stored in the JWT token (`ADMIN` or `STAFF`)

### Soft-delete

All records use soft-delete:
- `isArchived` flag (default: false)
- `archivedAt` timestamp
- `archivedById` tracks who archived it
- List views filter to `isArchived = false` by default
- No data is permanently deleted through the UI

### File storage (placeholder)

A `FileProvider` interface is defined in `src/shared/file-provider/types.ts`. This is not implemented in Stage 1 but establishes the architecture for Stage 3. The interface supports `upload`, `download`, `list`, and `delete` operations. SharePoint will be the first implementation, but it can be swapped for any other storage backend.

## Data model

### Separate User and Employee

- **User** = a login account for the system
- **Employee** = a business record for a real person
- Not every employee has a login
- Assets and plant are assigned to Employees, not Users
- `createdById` / `archivedById` point to Users (who performed the action)

### Relationships

```
User (login) ──creates──> Employee, Asset, Plant
User (login) ──archives──> Employee, Asset, Plant
Employee ──assigned──< Asset (one employee, many assets)
Employee ──assigned──< Plant (one employee, many plant items)
```
