// src/app/api/employees/lookup/route.ts
// Lookup employee by identityId — for external portals (Controller, WIP)

import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { validateServiceToken } from "@/shared/auth/service-token";

export async function GET(request: Request) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const identityId = searchParams.get("identityId");

  if (!identityId) {
    return NextResponse.json({ error: "identityId query parameter is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { identityId },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      location: true,
      status: true,
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json(employee);
}
