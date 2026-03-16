import { auth } from "./auth";
import { redirect } from "next/navigation";

/**
 * Get the current session or redirect to login.
 * Use this in server components / pages that require authentication.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Get the current session or redirect to login, and verify ADMIN role.
 * Use this in server components / pages that require admin access.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
