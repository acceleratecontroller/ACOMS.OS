// GET /api/staff/me — Returns the current staff member's full profile
import { NextResponse } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      personalEmail: true,
      phone: true,
      address: true,
      dateOfBirth: true,
      shirtSize: true,
      pantsSize: true,
      employmentType: true,
      location: true,
      startDate: true,
      status: true,
      emergencyFirstName: true,
      emergencyLastName: true,
      emergencyRelation: true,
      emergencyPhone: true,
      emergencyPhoneAlt: true,
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json(employee);
}
