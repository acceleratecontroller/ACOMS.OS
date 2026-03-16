# ACOMS.OS — Company Operations Platform

ACOMS.OS is a modular, web-based internal operations platform built to be the central system of record for structured business data.

## What this does

Provides a clean, professional web interface for managing:

- **Employee Register** — staff records, positions, departments
- **Asset Register** — portable items like tools, phones, laptops, PPE
- **Plant Register** — larger equipment like cars, trucks, excavators

Each module works independently. New modules can be added without breaking existing ones.

## Current status: Stage 1 — Foundation

Stage 1 delivers:
- Project framework (Next.js + TypeScript + PostgreSQL)
- Database schema for Employees, Assets, and Plant
- Basic CRUD UI for all three registers
- Admin authentication (email + password)
- Soft-delete/archive on all records
- Placeholder architecture for future file attachments
- Full documentation

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| DB Toolkit | Prisma |
| Authentication | NextAuth.js (Auth.js v5) |

## How to run it locally

### Prerequisites

- Node.js 18 or later
- PostgreSQL database (local or hosted)

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
   Edit `.env` and set your `DATABASE_URL` to point to your PostgreSQL database.
   Generate a secret: `openssl rand -base64 32` and paste it as `NEXTAUTH_SECRET` and `AUTH_SECRET`.

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
   This creates a default admin login:
   - Email: `admin@acoms.local`
   - Password: `admin123`
   - **Change this immediately in a real deployment.**

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open the app**
   Go to [http://localhost:3000](http://localhost:3000)

## Project structure

```
ACOMS.OS/
├── docs/              Documentation
├── prisma/            Database schema and migrations
├── src/
│   ├── app/           Pages and API routes (Next.js App Router)
│   ├── modules/       Module-specific business logic
│   ├── shared/        Reusable shared code
│   └── config/        Centralised configuration
```

See [docs/architecture.md](docs/architecture.md) for full details.

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
