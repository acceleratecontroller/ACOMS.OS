// src/app/api/employees/assignees/route.ts
// Returns list of active employees for assignee dropdowns — for external portals

import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { validateServiceToken } from "@/shared/auth/service-token";

export async function GET(request: Request) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE", isArchived: false },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      location: true,
      identityId: true,
    },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ employees });
}
