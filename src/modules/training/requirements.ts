import { prisma } from "@/shared/database/client";

export interface AccreditationRequirement {
  accreditationId: string;
  required: boolean;
}

/**
 * Ensure every given employee has a PENDING EmployeeAccreditation row for each
 * given accreditation. Existing rows are left untouched so manually-set
 * statuses (VERIFIED, EXPIRED, EXEMPT, etc.), dates and required flags are
 * preserved.
 *
 * New rows inherit the `required` flag from the requirement definition so
 * Required/Other propagates from SkillAccreditationLink down to the employee.
 *
 * Returns the number of rows created.
 */
export async function ensureEmployeeAccreditations(
  employeeIds: string[],
  requirements: AccreditationRequirement[],
): Promise<number> {
  if (employeeIds.length === 0 || requirements.length === 0) return 0;

  const accreditationIds = requirements.map((r) => r.accreditationId);
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

  const toCreate: { employeeId: string; accreditationId: string; required: boolean }[] = [];
  for (const employeeId of employeeIds) {
    for (const req of requirements) {
      if (!existingKeys.has(`${employeeId}:${req.accreditationId}`)) {
        toCreate.push({
          employeeId,
          accreditationId: req.accreditationId,
          required: req.required,
        });
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
 * Back-fill PENDING EmployeeAccreditation rows after a skill is newly linked
 * to a role. Every employee assigned the role gets a PENDING row for each
 * accreditation the skill requires. The `required` flag on the new rows is
 * the AND of the role-skill and skill-accreditation flags (both must be
 * Required for the employee-level row to be Required).
 */
export async function backfillForRoleSkillLink(
  roleId: string,
  skillId: string,
  roleSkillRequired: boolean,
): Promise<number> {
  const [employees, accreditations] = await Promise.all([
    prisma.employeeRole.findMany({
      where: { roleId },
      select: { employeeId: true },
    }),
    prisma.skillAccreditationLink.findMany({
      where: { skillId },
      select: { accreditationId: true, required: true },
    }),
  ]);
  const requirements = accreditations.map((a) => ({
    accreditationId: a.accreditationId,
    required: roleSkillRequired && a.required,
  }));
  return ensureEmployeeAccreditations(
    employees.map((e) => e.employeeId),
    requirements,
  );
}

/**
 * Back-fill PENDING EmployeeAccreditation rows after an accreditation is
 * newly linked to a skill. Every employee with a role that uses this skill
 * gets a PENDING row, inheriting the AND of that role-skill's `required`
 * flag and the skill-accreditation `required` flag.
 */
export async function backfillForSkillAccreditationLink(
  skillId: string,
  accreditationId: string,
  skillAccredRequired: boolean,
): Promise<number> {
  // For each employee, find the max of (roleSkillRequired) across their roles
  // that link to this skill. If any of those role-skill links is Required,
  // the per-employee `required` is `true && skillAccredRequired`; otherwise
  // it's `false && skillAccredRequired` = false.
  const employeeRoles = await prisma.employeeRole.findMany({
    where: { role: { skillLinks: { some: { skillId } } } },
    select: {
      employeeId: true,
      role: {
        select: {
          skillLinks: {
            where: { skillId },
            select: { required: true },
          },
        },
      },
    },
  });
  const effectiveByEmployee = new Map<string, boolean>();
  for (const er of employeeRoles) {
    const anyRequired = er.role.skillLinks.some((sl) => sl.required);
    if (effectiveByEmployee.get(er.employeeId) === true) continue;
    effectiveByEmployee.set(er.employeeId, anyRequired);
  }

  // Group employees by their effective flag so we can batch-create.
  let total = 0;
  const byFlag = new Map<boolean, string[]>();
  for (const [eid, roleReq] of effectiveByEmployee) {
    const effective = roleReq && skillAccredRequired;
    const arr = byFlag.get(effective) || [];
    arr.push(eid);
    byFlag.set(effective, arr);
  }
  for (const [effective, employeeIds] of byFlag) {
    total += await ensureEmployeeAccreditations(
      employeeIds,
      [{ accreditationId, required: effective }],
    );
  }
  return total;
}

/**
 * Compute the accreditation requirements for a role — the set of
 * accreditation IDs reachable via role→skill→accreditation with the
 * effective `required` flag (AND across link levels; Required wins across
 * multiple paths to the same accreditation).
 */
export async function accreditationRequirementsForRole(
  roleId: string,
): Promise<AccreditationRequirement[]> {
  const roleSkillLinks = await prisma.roleSkillLink.findMany({
    where: { roleId },
    select: {
      required: true,
      skill: {
        select: {
          accreditationLinks: { select: { accreditationId: true, required: true } },
        },
      },
    },
  });
  const byId = new Map<string, boolean>();
  for (const rsl of roleSkillLinks) {
    for (const sal of rsl.skill.accreditationLinks) {
      const effective = rsl.required && sal.required;
      const current = byId.get(sal.accreditationId);
      if (current === true) continue;
      byId.set(sal.accreditationId, effective);
    }
  }
  return [...byId.entries()].map(([accreditationId, required]) => ({
    accreditationId,
    required,
  }));
}

/**
 * Remove orphaned PENDING/EXEMPT EmployeeAccreditation rows for each given
 * employee — rows whose accreditation is no longer required by any of that
 * employee's current roles (regardless of required/other flag on the link).
 * VERIFIED and EXPIRED rows are always kept — they represent real evidence.
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
    const stillLinked = new Set<string>();
    emp.trainingRoles.forEach((tr) => {
      tr.role.skillLinks.forEach((sl) => {
        sl.skill.accreditationLinks.forEach((al) => {
          stillLinked.add(al.accreditationId);
        });
      });
    });

    const where = {
      employeeId: emp.id,
      status: { in: ["PENDING", "EXEMPT"] as ("PENDING" | "EXEMPT")[] },
      ...(stillLinked.size > 0 ? { accreditationId: { notIn: [...stillLinked] } } : {}),
    };

    const { count } = await prisma.employeeAccreditation.deleteMany({ where });
    totalDeleted += count;
  }
  return totalDeleted;
}

export async function employeeIdsWithRole(roleId: string): Promise<string[]> {
  const rows = await prisma.employeeRole.findMany({
    where: { roleId },
    select: { employeeId: true },
  });
  return rows.map((r) => r.employeeId);
}

export async function employeeIdsWithSkill(skillId: string): Promise<string[]> {
  const rows = await prisma.employeeRole.findMany({
    where: { role: { skillLinks: { some: { skillId } } } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });
  return rows.map((r) => r.employeeId);
}
