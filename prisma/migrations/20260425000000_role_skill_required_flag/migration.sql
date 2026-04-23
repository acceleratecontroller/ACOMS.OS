-- Required vs Other flag on the role→skill link. Default true keeps every
-- existing link in the Required bucket, so compliance math is unchanged
-- until someone marks specific skills as Other at the role level.
ALTER TABLE "RoleSkillLink" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
