import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/shared/database/client";
import { verifyDeviceToken } from "@/shared/auth/trusted-device";

const TRUST_COOKIE_NAME = "acoms_trusted_device";

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

        // Check if this device is trusted (remember me)
        let deviceTrusted = false;
        if (user.twoFactorEnabled) {
          try {
            const cookieStore = await cookies();
            const trustToken = cookieStore.get(TRUST_COOKIE_NAME)?.value;
            if (trustToken) {
              const device = await verifyDeviceToken(trustToken, user.id);
              deviceTrusted = !!device;
            }
          } catch {
            // cookies() may fail in some contexts — not critical
          }
        }

        if (user.twoFactorEnabled && !deviceTrusted) {
          // Clear 2FA verification so this new session requires fresh verification
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorVerifiedAt: null },
          });
        } else if (user.twoFactorEnabled && deviceTrusted) {
          // Device is trusted — auto-verify 2FA
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorVerifiedAt: new Date() },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          employeeId: user.employee?.id,
          deviceTrusted,
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
        const deviceTrusted = (user as { deviceTrusted?: boolean }).deviceTrusted ?? false;
        // If 2FA is enabled and device is not trusted, they need to verify
        token.twoFactorVerified = !token.twoFactorEnabled || deviceTrusted;
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
          // 2FA verified if: not required, or verified in DB (login clears the field, verify sets it)
          token.twoFactorVerified = !dbUser.twoFactorEnabled || !!dbUser.twoFactorVerifiedAt;
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
