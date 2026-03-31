import { redirect } from "next/navigation";
import { auth, signIn } from "@/shared/auth/auth";

export default async function LoginPage() {
  // If already authenticated, go to dashboard
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  // Otherwise, trigger the OIDC sign-in flow directly
  return signIn("acoms-auth", { redirectTo: "/" });
}
