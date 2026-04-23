-- Required vs Other flag on SkillAccreditationLink and EmployeeAccreditation.
-- Default true means every existing row is treated as Required (preserves
-- existing compliance behaviour).
ALTER TABLE "SkillAccreditationLink" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmployeeAccreditation" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
