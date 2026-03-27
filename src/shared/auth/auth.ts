// src/shared/auth/auth.ts — OIDC provider pointing to ACOMS.Auth

import NextAuth from "next-auth";
import { prisma } from "@/shared/database/client";
import "@/shared/auth/types";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "acoms-auth",
      name: "ACOMS.Auth",
      type: "oidc",
      issuer: process.env.ACOMS_AUTH_URL,
      clientId: process.env.ACOMS_AUTH_CLIENT_ID,
      clientSecret: process.env.ACOMS_AUTH_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email roles",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email as string,
          name: profile.name as string,
          role: profile.role as string,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        // Initial sign-in: populate from OIDC claims
        token.role = profile.role as string;
        token.identityId = profile.sub as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.identityId = token.identityId as string;

        // Look up employee record linked to this identity
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
