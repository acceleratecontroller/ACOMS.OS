import { signOut } from "@/shared/auth/auth";

export async function GET() {
  return signOut({ redirectTo: "/login" });
}
