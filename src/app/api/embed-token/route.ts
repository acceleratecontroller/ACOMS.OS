// API route for generating embed tokens for cross-origin iframe authentication.
// Called by the ControllerEmbed client component to get/refresh tokens.

import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { generateEmbedToken } from "@/shared/embed/token";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = generateEmbedToken({
    id: session.user.id ?? session.user.identityId,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    identityId: session.user.identityId,
  });

  return NextResponse.json({ token });
}
