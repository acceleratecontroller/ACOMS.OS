// GET /api/staff/training — Returns training roles and accreditations for the current staff member
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [roles, accreditations] = await Promise.all([
    prisma.employeeRole.findMany({
      where: { employeeId: session.user.employeeId },
      select: {
        id: true,
        assignedAt: true,
        role: {
          select: {
            id: true,
            roleNumber: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { role: { name: "asc" } },
    }),
    prisma.employeeAccreditation.findMany({
      where: { employeeId: session.user.employeeId },
      select: {
        id: true,
        status: true,
        issueDate: true,
        expiryDate: true,
        certificateNumber: true,
        notes: true,
        evidenceFileName: true,
        evidenceFileUrl: true,
        accreditation: {
          select: {
            id: true,
            accreditationNumber: true,
            code: true,
            name: true,
            expires: true,
            renewalMonths: true,
          },
        },
      },
      orderBy: { accreditation: { name: "asc" } },
    }),
  ]);

  return NextResponse.json({ roles, accreditations });
}
