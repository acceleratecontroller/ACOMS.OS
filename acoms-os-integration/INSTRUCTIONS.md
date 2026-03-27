# ACOMS.OS → ACOMS.Auth Integration

## What This Is

ACOMS.OS currently has its own built-in authentication (credentials provider, 2FA, backup codes, trusted devices). We're replacing all of that with ACOMS.Auth — a centralised SSO service that handles login, 2FA, and OIDC token issuance.

After this integration, ACOMS.OS will:
- Redirect unauthenticated users to `https://acoms-auth.vercel.app` for login
- Receive an OIDC ID token with claims (sub, email, name, role)
- Create a local NextAuth session from the token
- Never touch passwords, TOTP secrets, or 2FA logic again

## Live ACOMS.Auth Instance

- **URL**: `https://acoms-auth.vercel.app`
- **OIDC Discovery**: `https://acoms-auth.vercel.app/.well-known/openid-configuration`
- **JWKS**: `https://acoms-auth.vercel.app/.well-known/jwks.json`

## Credentials for ACOMS.OS

Add these to ACOMS.OS `.env`:

```env
# ACOMS.Auth OIDC Configuration
ACOMS_AUTH_URL=https://acoms-auth.vercel.app
ACOMS_AUTH_CLIENT_ID=acoms-os
ACOMS_AUTH_CLIENT_SECRET=174ad248cd45c16a5a34e74afc6e56e0bdc6b028c9daebbe53b62f2541d4ee59
ACOMS_AUTH_SERVICE_TOKEN=cc5b4c738b584aefa20d7a47d7a6008b08531f44cce10b57aaf04b6175a0eda4
```

## Implementation Steps

Follow these steps IN ORDER. Each step should work before moving to the next.

---

### Step 1: Add Environment Variables

Add the env vars above to `.env` and `.env.example`.

---

### Step 2: Replace NextAuth Configuration

Replace `src/shared/auth/auth.ts` with the OIDC provider configuration. See `auth.ts.reference` in this folder.

Key changes:
- Remove the `Credentials` provider entirely
- Add a custom OIDC provider pointing to ACOMS.Auth
- The JWT callback reads `role` and `identityId` from the OIDC profile claims
- The session callback looks up the Employee record by `identityId` (not `userId`)
- Remove all 2FA logic from callbacks (no more `twoFactorEnabled`, `twoFactorVerified`, `isRevoked`)
- Remove trusted device cookie checking

---

### Step 3: Update TypeScript Types

Replace `src/shared/auth/types.ts`. See `types.ts.reference` in this folder.

Changes:
- Remove `twoFactorEnabled`, `twoFactorVerified`, `deviceTrusted` from User
- Remove `twoFactorEnabled`, `twoFactorVerified`, `isRevoked` from JWT
- Add `identityId` to Session.user and JWT
- Keep `role` and `employeeId`

---

### Step 4: Update Prisma Schema

In `prisma/schema.prisma`:

1. **Delete** the `User` model entirely
2. **Delete** the `TrustedDevice` model
3. **Delete** the `BackupCode` model
4. On the `Employee` model:
   - Rename `userId` to `identityId`
   - Remove the `user User?` relation (no more local User model)
   - Keep `identityId String? @unique` as a plain field (it references ACOMS.Auth, not a local table)
5. On `AuditLog`:
   - Remove the `performedBy User?` relation
   - Keep `performedById String?` as a plain field (stores ACOMS.Auth identity ID)

Run `npx prisma migrate dev --name remove-local-auth` after making changes.

---

### Step 5: Update Middleware

Replace `src/middleware.ts`. See `middleware.ts.reference` in this folder.

Key simplification:
- No more 2FA redirect logic
- No more login page routing
- Just check for session cookie → if missing, redirect to NextAuth sign-in (which goes to ACOMS.Auth)
- Role-based route protection stays the same

---

### Step 6: Remove TwoFactorGuard

Remove `src/shared/components/TwoFactorGuard.tsx`.

In `src/app/(authenticated)/layout.tsx`, remove the `<TwoFactorGuard>` wrapper. The layout should just render children directly (ACOMS.Auth handles all 2FA before issuing tokens).

---

### Step 7: Delete Auth Files

Delete these files — they're now handled by ACOMS.Auth:

- `src/shared/auth/encryption.ts`
- `src/shared/auth/totp.ts`
- `src/shared/auth/backup-codes.ts`
- `src/shared/auth/trusted-device.ts`
- `src/shared/auth/rate-limit.ts`
- `src/app/(authenticated)/settings/security/page.tsx` (2FA settings page)
- All files under `src/app/api/auth/two-factor/` (setup, confirm, verify, disable, backup-codes, device-status routes)

---

### Step 8: Delete Login/2FA Pages

Delete these pages — login now happens on ACOMS.Auth:

- `src/app/login/page.tsx` (or the login route, wherever it is)
- `src/app/login/verify/page.tsx`
- `src/app/login/setup-2fa/page.tsx`

If there's a login layout, remove it too.

---

### Step 9: Update References Throughout Codebase

Search the codebase for:
- `userId` → replace with `identityId` where it refers to auth user ID
- `user.role` → should still work (comes from OIDC claims now)
- `session.user.employeeId` → should still work (looked up in session callback)
- `twoFactorEnabled` / `twoFactorVerified` → remove any checks for these
- `TwoFactorGuard` → remove any imports/usage
- `admin@acoms.local` → no longer relevant (super-admin is in ACOMS.Auth)

---

### Step 10: Add "Grant Access" API Route

Add `src/app/api/employees/[id]/access/route.ts`. See `access-route.ts.reference` in this folder.

This allows admins in ACOMS.OS to create login credentials for employees by calling the ACOMS.Auth service API.

---

### Step 11: Remove Unused Dependencies

```bash
npm uninstall otpauth qrcode @types/qrcode
```

Keep: `next-auth`, `bcryptjs` (if used elsewhere), `prisma`, `pg`.

---

### Step 12: Update Redirect URI in ACOMS.Auth

The ACOMS.OS callback URL needs to match what's registered in ACOMS.Auth. The current registered URIs are:
- `http://localhost:3001/api/auth/callback/acoms-auth`
- `https://acoms.yourdomain.com/api/auth/callback/acoms-auth`

If ACOMS.OS runs on a different port or domain, update the redirect URIs via the ACOMS.Auth admin panel (`/admin/portals`), or by calling:

```bash
PUT https://acoms-auth.vercel.app/api/admin/portals/{portal-id}
Authorization: Bearer cc5b4c738b584aefa20d7a47d7a6008b08531f44cce10b57aaf04b6175a0eda4

{
  "redirectUris": [
    "http://localhost:3000/api/auth/callback/acoms-auth",
    "https://your-acoms-os-domain.vercel.app/api/auth/callback/acoms-auth"
  ]
}
```

---

## Testing Checklist

After integration, verify:

1. Visiting ACOMS.OS redirects to ACOMS.Auth login page
2. Logging in with `admin@acoms.auth` / `admin123` redirects back to ACOMS.OS
3. Session contains: email, name, role, identityId
4. Role-based access control still works (ADMIN vs STAFF routes)
5. Sign out works
6. The settings/security page is gone (no more local 2FA management)
7. No references to `User` model remain in the codebase
