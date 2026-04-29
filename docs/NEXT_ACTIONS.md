# NEXT_ACTIONS.md — ACOMS.OS

> Prioritised, actionable list pulled from the audit log.

---

## Do Now (critical or high-risk)

1. **O-001 — Confirm and resolve the auth duality.** Is OS still capable of credentials login, or is the OIDC redirect now the only path? If legacy is dead, delete the credentials provider, the seed script, and rewrite the README.
2. **O-002 — Lock down the embed-token boundary.** Read `src/shared/embed/token.ts`. If the signing key is `AUTH_SECRET`, split into a dedicated env var, set TTL to ≤ 5 minutes, audience-bind to `/embed/tasks`.
3. **O-005 — Add a minimum test/CI baseline.** A handful of Vitest happy-path tests + one GitHub Action running `npm run lint` + tests on PR. Today there is no automated guard against regressions.
4. **O-015 — Rewrite the root README.** It still describes the legacy in-app Tasks module and the legacy credentials login. Both have changed.

## Do Soon (cleanup that prevents future pain)

5. **O-003 — Identity deactivation runbook (or auto-clear).** When Auth deactivates an Identity, OS should either auto-clear `Employee.identityId` or surface a clear admin task.
6. **O-004 — Confirm constant-time service-token comparison.** Read `src/shared/auth/service-token.ts`; switch to `crypto.timingSafeEqual` if needed.
7. **O-009 — Audit every `/api/staff/*` route handler** for the "self only" guard. Add a `requireStaffSelf(employeeId)` helper if missing.
8. **O-013 — Document the OS service-token rotation runbook** (which env vars to update, what to deploy first, what breaks while it's mid-rotation).
9. **O-018 — Show Auth Identity email + `Employee.email` side-by-side** on the Employee detail page; warn on mismatch.
10. **O-016 — Restrict the public Google Maps API key** to specific HTTP referrers and a usage quota in Google Cloud Console.

## Do Later (nice-to-have improvements)

11. **O-006 — Pagination on list endpoints.** Especially the cross-app `/api/employees/assignees` payload.
12. **O-007 — Client-side form validation** on the heavier forms (Employee, Plant) using `react-hook-form` + Zod.
13. **O-008 — Decide MANAGER role semantics in OS.** Either implement or document that MANAGER is treated as STAFF.
14. **O-010 — Strict audit log writes** — only if compliance demands it. Otherwise leave fire-and-forget.
15. **O-014 — Decide on uniqueness for `Asset.serialNumber` and `Plant.vinNumber`.**
16. **O-017 — Persist the global region filter on the server** instead of `localStorage`.
17. **O-020 — Document global-search match rules** (what fields, what role filters).

## Human Decisions Needed

- **Auth duality.** Yes/no — is OS still allowed to log in via credentials? Drives O-001.
- **Embed-token TTL and audience.** What's the operational tolerance? Drives O-002.
- **MANAGER role.** Use it or fold into STAFF? Drives O-008.
- **Service-token rotation cadence.** Annual? On-incident? Drives O-013.
- **Audit fidelity.** Is fire-and-forget OK forever? Drives O-010.
- **STAFF self-service scope.** Beyond training, what should STAFF see? Drives the staff-portal roadmap.

---

When you finish an item, mark its row in `docs/AUDIT_LOG.md` as `Fixed` (do not delete) and remove it from the list above.
