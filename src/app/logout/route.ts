import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
  const cookieStore = await cookies();

  // Delete all auth session cookies
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("authjs.callback-url");
  cookieStore.delete("__Secure-authjs.callback-url");
  cookieStore.delete("authjs.csrf-token");
  cookieStore.delete("__Host-authjs.csrf-token");

  redirect("/login");
}
