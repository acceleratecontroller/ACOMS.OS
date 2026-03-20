import "next-auth";
import "@auth/core/jwt";

// Extend the default NextAuth types to include our custom fields
declare module "next-auth" {
  interface User {
    role?: string;
    twoFactorEnabled?: boolean;
    employeeId?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      twoFactorEnabled: boolean;
      twoFactorVerified: boolean;
      employeeId?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    id?: string;
    twoFactorEnabled?: boolean;
    twoFactorVerified?: boolean;
    employeeId?: string;
    isRevoked?: boolean;
  }
}
