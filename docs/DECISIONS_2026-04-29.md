# Decisions Addendum — 2026-04-29 (OS)

> Companion to `NEXT_ACTIONS.md`. Records owner decisions made on 2026-04-29 and what they mean for this repo's queue. Master record: `acceleratecontroller/ACOMS.Controller/docs/system/DECISIONS_2026-04-29.md`.

## Now confirmed

### O-001 — Auth duality (decision D-01)
**The owner does not log in locally.** The legacy NextAuth credentials path is dead and can be removed safely.

This downgrades `O-001` from "Needs Human Review" to a concrete code task:

- Delete the credentials provider config in `src/shared/auth/auth.ts` (or whatever currently configures it).
- Delete the local seed script (`scripts/seed.mjs` if its purpose was the legacy admin user; verify before removing).
- Delete or rewrite the legacy `/login` page so it serves only the OIDC redirect.
- Rewrite the root README to describe only the OIDC flow.
- Confirm `package.json` no longer needs the `db:seed` script for normal operation.

Done in a follow-up code branch — **not done in this docs branch**.

### URGENT (related) — Rotate the leaked OS↔Auth credentials
The ACOMS.Auth repo previously contained the live `acoms-os` ClientApp **client secret** and **service token** in plain text inside `acoms-os-integration/INSTRUCTIONS.md`. They are committed to git history. This affects ACOMS.OS because OS holds matching values in its env vars.

After Auth rotates the values, update OS env vars in Vercel:
- `ACOMS_AUTH_CLIENT_SECRET` → new value.
- `ACOMS_AUTH_SERVICE_TOKEN` → new value.

OS does not need a code change for the rotation, just an env-var update.

## Architectural rule confirmed (D-09)
**Direct database access between apps is prohibited.** OS must not connect to ACOMS.Auth, ACOMS.WIP, or ACOMS.Controller databases. All cross-app data exchange goes through authenticated APIs.

This was already the case for OS, but recording it explicitly so future PRs can be rejected on review if anyone proposes a Prisma datasource pointing at another app's DB.

## Still deferred per owner's choice

- O-002 — Embed-token boundary (D-02). Will revisit later.
- O-013 — OS service-token rotation runbook (D-05).
- O-008 — MANAGER role semantics (D-06).

No change.
