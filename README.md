# ACOMS.OS — Company Operations Platform

ACOMS.OS is a modular, web-based internal operations platform built to be the central system of record for structured business data.

## What this does

Provides a clean, professional web interface for managing:

- **Employee Register** — staff records, positions, employment types, locations
- **Asset Register** — portable items like tools, phones, laptops, PPE
- **Plant Register** — larger equipment like cars, trucks, excavators
- **Task Manager** — quick tasks with priority/status tracking, plus recurring tasks with scheduled frequencies
- **Activity Log** — full audit trail of who changed what and when
- **Dashboard** — overview of active tasks, overdue items, and upcoming deadlines
- **Global Search** — search across employees, assets, plant, and tasks

Each module works independently. New modules can be added without breaking existing ones.

## Current status: Stage 1 — Foundation

Stage 1 delivers:
- Project framework (Next.js + TypeScript + PostgreSQL)
- Database schema for Employees, Assets, Plant, Tasks, Recurring Tasks, and Audit Log
- Full CRUD UI for all registers
- Task manager with quick tasks and recurring task scheduling
- Dashboard with overdue/upcoming task summaries
- Activity log with paginated audit trail
- Global search across all entities
- Admin authentication (email + password) with ADMIN/STAFF roles
- Soft-delete/archive on all records
- Zod validation on all API inputs
- Placeholder architecture for future file attachments

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (Neon) |
| DB Toolkit | Prisma 7 |
| Authentication | NextAuth.js (Auth.js v5) |
| Validation | Zod |

## How to run it locally

### Prerequisites

- Node.js 18 or later
- PostgreSQL database (local or hosted, e.g. Neon)

### Step-by-step setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd ACOMS.OS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `NEXTAUTH_SECRET` / `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` for local dev
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — (optional) for address autocomplete

4. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Seed the admin user**
   ```bash
   npm run db:seed
   ```
   Default login: `admin@acoms.local` / `admin123`
   **Change this immediately in any non-local environment.**

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open the app** — [http://localhost:3000](http://localhost:3000)

## Project structure

```
ACOMS.OS/
├── docs/                  Documentation
├── prisma/                Database schema and migrations
├── src/
│   ├── app/               Pages and API routes (Next.js App Router)
│   │   ├── (authenticated)/  Protected pages (employees, assets, plant, tasks, activity-log)
│   │   ├── login/            Login page
│   │   └── api/              Backend API routes
│   │       ├── auth/         Authentication endpoint
│   │       ├── employees/    Employee CRUD API
│   │       ├── assets/       Asset CRUD API
│   │       ├── plant/        Plant CRUD API
│   │       ├── tasks/        Task CRUD + complete API
│   │       ├── recurring-tasks/  Recurring task CRUD + complete API
│   │       ├── activity-log/ Paginated audit log API
│   │       ├── dashboard/    Dashboard summary stats API
│   │       └── search/       Global search API
│   ├── modules/           Module-specific business logic and validation
│   ├── shared/            Reusable shared code (auth, components, database, audit)
│   └── config/            Centralised configuration (navigation, constants)
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Auth model

- **NextAuth.js v5** with credentials provider (email + password, bcrypt)
- JWT-based sessions
- Two roles: `ADMIN` (full CRUD) and `STAFF` (read-only)
- Middleware redirects unauthenticated users to `/login`
- All API routes check session and role

## Current limitations

- No tests or CI/CD pipeline
- No rate limiting on endpoints
- No client-side form validation (server-side only via Zod)
- No pagination on list endpoints (except activity log)
- No field-level access control for PII
- File attachments not yet implemented (interface only)
- NextAuth v5 is still in beta

## Documentation

- [Project Overview](docs/project-overview.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Decisions Log](docs/decisions.md)
- [Permissions](docs/permissions.md)
- [Integrations](docs/integrations.md)
- [Employee Register](docs/modules/employee-register.md)
- [Asset Register](docs/modules/asset-register.md)
- [Plant Register](docs/modules/plant-register.md)

---

**Maintenance note:** Update this README and relevant docs whenever major features, modules, architecture, setup steps, or dependencies change.
