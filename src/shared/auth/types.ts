// src/shared/auth/types.ts — ACOMS.Auth OIDC session types

import "next-auth";
import "@auth/core/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      identityId: string;  // ACOMS.Auth identity UUID (the "sub" claim)
      email: string;
      name: string;
      role: string;        // Portal-specific role from OIDC claims
      employeeId?: string; // Looked up from portal DB
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    identityId?: string;
    employeeId?: string;
  }
}
