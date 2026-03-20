import { NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { withPrismaError } from "@/shared/api/helpers";

// GET /api/training/compliance-summary
// Returns counts of employees with expired and soon-to-expire accreditations.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Count distinct employees with at least one expired accreditation
  // (accreditation.expires = true AND expiryDate < today AND status is not EXEMPT)
  const { result: expiredEmployees, error: err1 } = await withPrismaError(
    "Failed to count expired accreditations",
    () =>
      prisma.employeeAccreditation.findMany({
        where: {
          expiryDate: { lt: today },
          accreditation: { expires: true, isArchived: false },
          employee: { isArchived: false },
          status: { not: "EXEMPT" },
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

  return NextResponse.json({
    expired: expiredEmployees.length,
    expiringSoon: expiringSoonEmployees.length,
  });
}
