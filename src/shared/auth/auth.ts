// src/shared/auth/auth.ts — OAuth provider pointing to ACOMS.Auth

import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
import { prisma } from "@/shared/database/client";
import "@/shared/auth/types";

interface AcomsAuthProfile {
  sub: string;
  email: string;
  name: string;
  role: string;
}

const AcomsAuthProvider: OAuthConfig<AcomsAuthProfile> = {
  id: "acoms-auth",
  name: "ACOMS.Auth",
  type: "oidc",
  // Skip discovery — specify everything explicitly
  issuer: process.env.ACOMS_AUTH_URL,
  wellKnown: `${process.env.ACOMS_AUTH_URL}/.well-known/openid-configuration`,
  clientId: process.env.ACOMS_AUTH_CLIENT_ID!,
  clientSecret: process.env.ACOMS_AUTH_CLIENT_SECRET!,
  authorization: {
    url: `${process.env.ACOMS_AUTH_URL}/oauth/authorize`,
    params: {
      scope: "openid profile email roles",
    },
  },
  token: `${process.env.ACOMS_AUTH_URL}/api/oauth/token`,
  userinfo: `${process.env.ACOMS_AUTH_URL}/api/oauth/userinfo`,
  checks: ["pkce", "state"],
  profile(profile) {
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    };
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  providers: [AcomsAuthProvider],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.role = profile.role as string;
        token.identityId = profile.sub as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.identityId = token.identityId as string;

        const employee = await prisma.employee.findUnique({
          where: { identityId: token.identityId as string },
          select: { id: true },
        });
        session.user.employeeId = employee?.id;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
