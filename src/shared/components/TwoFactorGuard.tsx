"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects users to /login/verify if they have 2FA enabled but haven't verified yet.
 * Wrap authenticated pages with this component.
 */
export function TwoFactorGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session?.user?.twoFactorEnabled &&
      !session?.user?.twoFactorVerified
    ) {
      router.push("/login/verify");
    }
  }, [session, status, router]);

  // While loading session, or if 2FA redirect is needed, show nothing
  if (status === "loading") return null;
  if (
    status === "authenticated" &&
    session?.user?.twoFactorEnabled &&
    !session?.user?.twoFactorVerified
  ) {
    return null;
  }

  return <>{children}</>;
}
