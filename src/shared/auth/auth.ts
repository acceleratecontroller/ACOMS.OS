import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/shared/database/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { employee: { select: { id: true } } },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        // Clear 2FA verification so this new session requires fresh verification
        if (user.twoFactorEnabled) {
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorVerifiedAt: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          employeeId: user.employee?.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.twoFactorEnabled = (user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false;
        // If 2FA is enabled, they haven't verified yet at login time
        token.twoFactorVerified = !token.twoFactorEnabled;
        token.employeeId = (user as { employeeId?: string }).employeeId;
      }
      // Re-validate user state on every request
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true, twoFactorEnabled: true, twoFactorVerifiedAt: true },
        });
        if (!dbUser || !dbUser.isActive) {
          // Mark token as revoked — session callback will reject it
          token.isRevoked = true;
        } else {
          // Keep role and 2FA status in sync with database
          token.role = dbUser.role;
          token.twoFactorEnabled = dbUser.twoFactorEnabled;
          // 2FA verified if: not required, or verified in DB since this token was issued
          if (!dbUser.twoFactorEnabled) {
            token.twoFactorVerified = true;
          } else if (dbUser.twoFactorVerifiedAt) {
            const tokenIssuedAt = (token.iat ?? 0) * 1000; // JWT iat is in seconds
            token.twoFactorVerified = dbUser.twoFactorVerifiedAt.getTime() >= tokenIssuedAt;
          } else {
            token.twoFactorVerified = false;
          }
          token.isRevoked = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If user has been revoked, return empty session to force logout
      if (token.isRevoked) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled ?? false;
        session.user.twoFactorVerified = token.twoFactorVerified ?? true;
        session.user.employeeId = token.employeeId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
