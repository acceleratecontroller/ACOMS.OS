# Project Overview

## What is ACOMS.OS?

ACOMS.OS is a web-based internal company operations platform. It is designed to be the single source of truth for structured business data across the company.

In plain English: instead of tracking employees, equipment, and assets in scattered spreadsheets, ACOMS.OS puts everything in one organised, searchable, professional system.

## Who is it for?

- **Admin users** manage records: creating, editing, and archiving employees, assets, and plant items.
- **Staff users** (future) will have limited access to view their own HR information and selected asset/plant data.

## What does it manage?

### Currently built (Stage 1)

| Module | What it tracks |
|--------|---------------|
| Employee Register | Staff records — names, positions, departments, employment status |
| Asset Register | Portable company items — tools, phones, laptops, PPE |
| Plant Register | Large equipment — cars, trucks, excavators, generators |

### Planned for later stages

| Module | Status |
|--------|--------|
| WIP Tracker | Planned — awaiting business requirements |
| Job Creation | Planned — awaiting business requirements |
| Corrective Actions | Planned |
| File/Document Attachments | Architecture in place, implementation in Stage 3 |
| Reporting & Dashboards | Planned |
| AI & Automation | Planned |

## Key principles

1. **Modular** — each area is built as a separate module with clear boundaries
2. **Simple** — admin pages and forms are easy to understand
3. **Documented** — every module has its own documentation
4. **Safe** — records are soft-deleted (archived), never permanently destroyed
5. **Independent from Microsoft 365** — SharePoint can be used for files, but the core system doesn't depend on it
6. **Auditable** — records track who created them and when

## How is it built?

- **Next.js** (React) for the web interface and API
- **PostgreSQL** for the database
- **Prisma** for database management
- **TypeScript** for type safety
- **NextAuth.js** for authentication
- **Tailwind CSS** for styling

See [architecture.md](architecture.md) for technical details.
