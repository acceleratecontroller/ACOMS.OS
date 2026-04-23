import { prisma } from "@/shared/database/client";

/**
 * Ensure every given employee has a PENDING EmployeeAccreditation row for each
 * given accreditation. Existing rows are left untouched so manually set statuses
 * (COMPLETED, EXEMPT, etc.) and dates are preserved.
 *
 * Returns the number of rows created.
 */
export async function ensureEmployeeAccreditations(
  employeeIds: string[],
  accreditationIds: string[],
): Promise<number> {
  if (employeeIds.length === 0 || accreditationIds.length === 0) return 0;

  const existing = await prisma.employeeAccreditation.findMany({
    where: {
      employeeId: { in: employeeIds },
      accreditationId: { in: accreditationIds },
    },
    select: { employeeId: true, accreditationId: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.employeeId}:${e.accreditationId}`),
  );

  const toCreate: { employeeId: string; accreditationId: string }[] = [];
  for (const employeeId of employeeIds) {
    for (const accreditationId of accreditationIds) {
      if (!existingKeys.has(`${employeeId}:${accreditationId}`)) {
        toCreate.push({ employeeId, accreditationId });
      }
    }
  }
  if (toCreate.length === 0) return 0;

  const { count } = await prisma.employeeAccreditation.createMany({
    data: toCreate.map((row) => ({ ...row, status: "PENDING" as const })),
    skipDuplicates: true,
  });
  return count;
}

/**
 * Back-fill PENDING EmployeeAccreditation rows after a skill is newly linked to
 * a role: every employee currently assigned the role gets a PENDING row for
 * each accreditation the skill already requires.
 */
export async function backfillForRoleSkillLink(
  roleId: string,
  skillId: string,
): Promise<number> {
  const [employees, accreditations] = await Promise.all([
    prisma.employeeRole.findMany({
      where: { roleId },
      select: { employeeId: true },
    }),
    prisma.skillAccreditationLink.findMany({
      where: { skillId },
      select: { accreditationId: true },
    }),
  ]);
  return ensureEmployeeAccreditations(
    employees.map((e) => e.employeeId),
    accreditations.map((a) => a.accreditationId),
  );
}

/**
 * Back-fill PENDING EmployeeAccreditation rows after an accreditation is newly
 * linked to a skill: every employee assigned to any role that uses this skill
 * gets a PENDING row for the new accreditation.
 */
export async function backfillForSkillAccreditationLink(
  skillId: string,
  accreditationId: string,
): Promise<number> {
  const employees = await prisma.employeeRole.findMany({
    where: { role: { skillLinks: { some: { skillId } } } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return ensureEmployeeAccreditations(
    employees.map((e) => e.employeeId),
    [accreditationId],
  );
}

/**
 * Compute the set of accreditation IDs required by a role (via its current
 * skills). Used when assigning a role to an employee.
 */
export async function accreditationIdsForRole(
  roleId: string,
): Promise<string[]> {
  const links = await prisma.skillAccreditationLink.findMany({
    where: { skill: { roleLinks: { some: { roleId } } } },
    select: { accreditationId: true },
  });
  return [...new Set(links.map((l) => l.accreditationId))];
}

/**
 * Remove orphaned PENDING/EXEMPT EmployeeAccreditation rows for each given
 * employee — i.e. rows whose accreditation is no longer required by any of
 * that employee's current roles. VERIFIED and EXPIRED rows are always kept
 * (they represent real evidence of qualifications earned).
 *
 * Call this after any operation that can sever a
 * role→skill→accreditation link: removing an employee's role, removing a
 * skill from a role, or removing an accreditation from a skill.
 *
 * Returns the number of rows deleted.
 */
export async function cleanupOrphanedPendingAndExempt(
  employeeIds: string[],
): Promise<number> {
  if (employeeIds.length === 0) return 0;

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
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
                      accreditationLinks: { select: { accreditationId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let totalDeleted = 0;
  for (const emp of employees) {
    const required = new Set<string>();
    emp.trainingRoles.forEach((tr) => {
      tr.role.skillLinks.forEach((sl) => {
        sl.skill.accreditationLinks.forEach((al) => {
          required.add(al.accreditationId);
        });
      });
    });

    const where = {
      employeeId: emp.id,
      status: { in: ["PENDING", "EXEMPT"] as ("PENDING" | "EXEMPT")[] },
      ...(required.size > 0 ? { accreditationId: { notIn: [...required] } } : {}),
    };

    const { count } = await prisma.employeeAccreditation.deleteMany({ where });
    totalDeleted += count;
  }
  return totalDeleted;
}

/**
 * Get all employee IDs currently assigned a given role.
 */
export async function employeeIdsWithRole(roleId: string): Promise<string[]> {
  const rows = await prisma.employeeRole.findMany({
    where: { roleId },
    select: { employeeId: true },
  });
  return rows.map((r) => r.employeeId);
}

/**
 * Get all employee IDs currently assigned to any role that uses a given skill.
 */
export async function employeeIdsWithSkill(skillId: string): Promise<string[]> {
  const rows = await prisma.employeeRole.findMany({
    where: { role: { skillLinks: { some: { skillId } } } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return rows.map((r) => r.employeeId);
}
