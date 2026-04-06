// GET /api/staff/dashboard — Returns all dashboard summary data for the current staff member
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = session.user.employeeId;
  const now = new Date();

  const [
    employee,
    assetCount,
    plantCount,
    accreditations,
    roles,
  ] = await Promise.all([
    // Basic employee info for welcome header
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeNumber: true,
        employmentType: true,
        location: true,
        status: true,
      },
    }),
    // Count of assigned assets
    prisma.asset.count({
      where: { assignedToId: employeeId, isArchived: false },
    }),
    // Count of assigned plant
    prisma.plant.count({
      where: { assignedToId: employeeId, isArchived: false },
    }),
    // All accreditations with status
    prisma.employeeAccreditation.findMany({
      where: { employeeId },
      select: {
        status: true,
        expiryDate: true,
        accreditation: {
          select: {
            name: true,
            expires: true,
          },
        },
      },
    }),
    // Training roles
    prisma.employeeRole.findMany({
      where: { employeeId },
      select: {
        role: {
          select: { name: true, category: true },
        },
      },
    }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Compute accreditation summary
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  let expired = 0;
  let expiringSoon = 0;
  let current = 0;
  let pending = 0;

  for (const a of accreditations) {
    if (a.status === "EXPIRED") {
      expired++;
    } else if (a.status === "PENDING") {
      pending++;
    } else if (
      a.status === "VERIFIED" &&
      a.accreditation.expires &&
      a.expiryDate &&
      a.expiryDate <= ninetyDaysFromNow
    ) {
      if (a.expiryDate <= now) {
        expired++;
      } else {
        expiringSoon++;
      }
    } else if (a.status === "VERIFIED" || a.status === "EXEMPT") {
      current++;
    }
  }

  return NextResponse.json({
    employee,
    counts: {
      assets: assetCount,
      plant: plantCount,
      trainingRoles: roles.length,
      accreditations: accreditations.length,
    },
    compliance: { expired, expiringSoon, current, pending },
    roles: roles.map((r) => r.role),
  });
}
