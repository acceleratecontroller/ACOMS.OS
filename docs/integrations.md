# Integrations

## Overview

ACOMS.OS is designed to be independent from external services. Integrations are built behind abstractions so they can be swapped without redesigning the core system.

## File storage — FileProvider abstraction

### Current status: Placeholder (Stage 1)

The `FileProvider` interface is defined but not implemented. It lives in `src/shared/file-provider/types.ts`.

### How it works

```
Your records (Employee, Asset, Plant)
        │
        ▼
  FileProvider interface  ←── defined in Stage 1
        │
        ▼
  Concrete implementation ←── built in Stage 3
   (SharePoint, S3, etc.)
```

The interface defines four operations:
- `upload` — store a file and link it to a record
- `download` — retrieve a file
- `listByRecord` — list all files for a given record
- `delete` — remove a file

### Planned first implementation: SharePoint

A `SharePointProvider` will be the first real implementation (Stage 3). It will:
- Connect to SharePoint via Microsoft Graph API
- Store files in a configured document library
- Track file references in the database

### Why this design?

SharePoint is convenient now, but the business may want to switch to S3, Azure Blob, or local storage later. By hiding the storage behind an interface, swapping providers means writing one new file — not rewriting the whole application.

## Authentication — NextAuth.js

### Current status: Implemented (Stage 1)

- Email + password login via Credentials provider
- Passwords hashed with bcrypt
- JWT-based sessions

### Future possibilities

NextAuth.js supports many providers out of the box. Adding Google, Microsoft, or other SSO login later requires adding a provider config — no architecture changes needed.

## Database — PostgreSQL

### Current status: Schema defined (Stage 1)

- PostgreSQL via any hosting provider (Supabase, Neon, Railway, self-hosted)
- Used **only as a database** — not using any provider-specific auth or features
- This means the database host can be changed at any time

## External services NOT integrated

The following are explicitly **not** integrated and are not dependencies:

- Microsoft 365 / Azure AD (no SSO dependency)
- Supabase Auth (using Supabase only as a Postgres host if chosen)
- Any notification service (email, SMS, Slack)
- Any AI/ML service

These may be added in later stages behind appropriate abstractions.
