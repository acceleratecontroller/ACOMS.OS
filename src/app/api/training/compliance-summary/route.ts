import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { withPrismaError } from "@/shared/api/helpers";

// GET /api/training/compliance-summary
// Returns counts of employees with expired, expiring-soon, missing, and pending accreditations.
// Admin only — STAFF users view their own training data through the employee endpoints.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Auto-expire: flip VERIFIED → EXPIRED where expiryDate has passed
  await prisma.employeeAccreditation.updateMany({
    where: {
      status: "VERIFIED",
      expiryDate: { lt: today },
      accreditation: { expires: true, isArchived: false },
    },
    data: { status: "EXPIRED" },
  });

  // Count distinct employees with at least one expired accreditation
  const { result: expiredEmployees, error: err1 } = await withPrismaError(
    "Failed to count expired accreditations",
    () =>
      prisma.employeeAccreditation.findMany({
        where: {
          accreditation: { expires: true, isArchived: false },
          employee: { isArchived: false },
          status: "EXPIRED",
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
  );
  if (err1) return err1;

  // Count distinct employees with accreditations expiring within 30 days
  const { result: expiringSoonEmployees, error: err2 } = await withPrismaError(
    "Failed to count expiring-soon accreditations",
    () =>
      prisma.employeeAccreditation.findMany({
        where: {
          expiryDate: { gte: today, lte: thirtyDaysFromNow },
          accreditation: { expires: true, isArchived: false },
          employee: { isArchived: false },
          status: { not: "EXEMPT" },
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
  );
  if (err2) return err2;

  // Count distinct employees with pending accreditations
  const { result: pendingEmployees, error: err3 } = await withPrismaError(
    "Failed to count pending accreditations",
    () =>
      prisma.employeeAccreditation.findMany({
        where: {
          status: "PENDING",
          accreditation: { isArchived: false },
          employee: { isArchived: false },
        },
        select: { employeeId: true },
        distinct: ["employeeId"],
      }),
  );
  if (err3) return err3;

  // Count distinct employees missing required accreditations
  // (employee has a training role that requires an accreditation they don't hold at all)
  const { result: employeesWithRoles, error: err4 } = await withPrismaError(
    "Failed to count missing accreditations",
    () =>
      prisma.employee.findMany({
        where: { isArchived: false, trainingRoles: { some: {} } },
        select: {
          id: true,
          trainingRoles: {
            select: {
              role: {
                select: {
                  skillLinks: {
                    select: {
                      skill: {
                        select: {
                          accreditationLinks: {
                            where: { accreditation: { isArchived: false } },
                            select: { accreditationId: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          accreditations: {
            select: { accreditationId: true },
          },
        },
      }),
  );
  if (err4) return err4;

  let missingCount = 0;
  for (const emp of employeesWithRoles) {
    const requiredIds = new Set<string>();
    for (const tr of emp.trainingRoles) {
      for (const sl of tr.role.skillLinks) {
        for (const al of sl.skill.accreditationLinks) {
          requiredIds.add(al.accreditationId);
        }
      }
    }
    const heldIds = new Set(emp.accreditations.map((a) => a.accreditationId));
    for (const reqId of requiredIds) {
      if (!heldIds.has(reqId)) {
        missingCount++;
        break; // count employee once
      }
    }
  }

  return NextResponse.json({
    expired: expiredEmployees.length,
    expiringSoon: expiringSoonEmployees.length,
    pending: pendingEmployees.length,
    missing: missingCount,
  });
}
