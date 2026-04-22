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
