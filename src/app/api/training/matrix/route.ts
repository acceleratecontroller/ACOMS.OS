import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { withPrismaError } from "@/shared/api/helpers";

// GET /api/training/matrix — Full role→skill→accreditation tree + employee summary
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const view = request.nextUrl.searchParams.get("view"); // "tree" or "employees"

  // Auto-expire: flip VERIFIED → EXPIRED where expiryDate has passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.employeeAccreditation.updateMany({
    where: {
      status: "VERIFIED",
      expiryDate: { lt: today },
      accreditation: { expires: true, isArchived: false },
    },
    data: { status: "EXPIRED" },
  });

  if (view === "employees") {
    // Employee view: all active employees with their roles + accreditations
    const { result: employees, error } = await withPrismaError("Failed to load employee training data", () =>
      prisma.employee.findMany({
        where: { isArchived: false },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          roleType: true,
          location: true,
          status: true,
          trainingRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  roleNumber: true,
                  name: true,
                  category: true,
                  isArchived: true,
                  skillLinks: {
                    include: {
                      skill: {
                        select: {
                          id: true,
                          name: true,
                          isArchived: true,
                          accreditationLinks: {
                            include: {
                              accreditation: {
                                select: { id: true, accreditationNumber: true, name: true, expires: true, renewalMonths: true },
                              },
                            },
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
            include: {
              accreditation: {
                select: { id: true, accreditationNumber: true, name: true, isArchived: true, expires: true, renewalMonths: true },
              },
            },
          },
        },
        orderBy: { firstName: "asc" },
      }),
    );
    if (error) return error;

    return NextResponse.json(employees);
  }

  // Tree view: roles → skills → accreditations
  const [rolesResult, unlinkedSkillsResult, unlinkedAccrResult] = await Promise.all([
    withPrismaError("Failed to load roles", () =>
      prisma.trainingRole.findMany({
        where: { isArchived: false },
        include: {
          skillLinks: {
            include: {
              skill: {
                select: {
                  id: true,
                  skillNumber: true,
                  name: true,
                  description: true,
                  isArchived: true,
                  accreditationLinks: {
                    include: {
                      accreditation: {
                        select: {
                          id: true,
                          accreditationNumber: true,
                          name: true,
                          description: true,
                          isArchived: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ),
    // Skills not linked to any role
    withPrismaError("Failed to load unlinked skills", () =>
      prisma.trainingSkill.findMany({
        where: {
          isArchived: false,
          roleLinks: { none: {} },
        },
        include: {
          accreditationLinks: {
            include: {
              accreditation: {
                select: { id: true, accreditationNumber: true, name: true, isArchived: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ),
    // Accreditations not linked to any skill
    withPrismaError("Failed to load unlinked accreditations", () =>
      prisma.accreditation.findMany({
        where: {
          isArchived: false,
          skillLinks: { none: {} },
        },
        orderBy: { name: "asc" },
      }),
    ),
  ]);

  if (rolesResult.error) return rolesResult.error;
  if (unlinkedSkillsResult.error) return unlinkedSkillsResult.error;
  if (unlinkedAccrResult.error) return unlinkedAccrResult.error;

  return NextResponse.json({
    roles: rolesResult.result,
    unlinkedSkills: unlinkedSkillsResult.result,
    unlinkedAccreditations: unlinkedAccrResult.result,
  });
}
