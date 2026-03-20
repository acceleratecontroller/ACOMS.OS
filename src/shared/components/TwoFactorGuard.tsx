"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ADMIN_EMAIL = "admin@acoms.local";

/**
 * Guards authenticated pages:
 * - If 2FA is enabled but not verified this session → redirect to /login/verify
 * - If 2FA is not enabled and user is not the root admin → redirect to /login/setup-2fa
 */
export function TwoFactorGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const needsVerify =
    status === "authenticated" &&
    session?.user?.twoFactorEnabled &&
    !session?.user?.twoFactorVerified;

  const needsSetup =
    status === "authenticated" &&
    !session?.user?.twoFactorEnabled &&
    session?.user?.email !== ADMIN_EMAIL;

  useEffect(() => {
    if (needsVerify) {
      router.push("/login/verify");
    } else if (needsSetup) {
      router.push("/login/setup-2fa");
    }
  }, [needsVerify, needsSetup, router]);

  if (status === "loading") return null;
  if (needsVerify || needsSetup) return null;

  return <>{children}</>;
}
