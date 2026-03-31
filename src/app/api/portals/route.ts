// src/app/api/portals/route.ts
// Fetches available portals from ACOMS.Auth admin API

import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const response = await fetch(
      `${process.env.ACOMS_AUTH_URL}/api/admin/portals`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch portals from ACOMS.Auth" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to ACOMS.Auth" },
      { status: 502 }
    );
  }
}
