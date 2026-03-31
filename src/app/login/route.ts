import { signIn } from "@/shared/auth/auth";

export async function GET() {
  return signIn("acoms-auth", { redirectTo: "/" });
}
