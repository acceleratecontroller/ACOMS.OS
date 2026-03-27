-- Remove local authentication: migrate to ACOMS.Auth SSO
-- This migration removes the User, BackupCode, and TrustedDevice tables,
-- drops all foreign keys referencing User, renames Employee.userId to identityId,
-- and removes the AuditLog.performedBy FK constraint.

-- ============================================================
-- 1. Drop all foreign keys referencing the User table
-- ============================================================

-- AuditLog
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_performedById_fkey";

-- Employee
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_createdById_fkey";
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_archivedById_fkey";
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_userId_fkey";

-- Asset
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_createdById_fkey";
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_archivedById_fkey";

-- Plant
ALTER TABLE "Plant" DROP CONSTRAINT IF EXISTS "Plant_createdById_fkey";
ALTER TABLE "Plant" DROP CONSTRAINT IF EXISTS "Plant_archivedById_fkey";

-- Task
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_createdById_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_archivedById_fkey";

-- RecurringTask
ALTER TABLE "RecurringTask" DROP CONSTRAINT IF EXISTS "RecurringTask_createdById_fkey";
ALTER TABLE "RecurringTask" DROP CONSTRAINT IF EXISTS "RecurringTask_archivedById_fkey";

-- TrainingRole
ALTER TABLE "TrainingRole" DROP CONSTRAINT IF EXISTS "TrainingRole_createdById_fkey";
ALTER TABLE "TrainingRole" DROP CONSTRAINT IF EXISTS "TrainingRole_archivedById_fkey";

-- TrainingSkill
ALTER TABLE "TrainingSkill" DROP CONSTRAINT IF EXISTS "TrainingSkill_createdById_fkey";
ALTER TABLE "TrainingSkill" DROP CONSTRAINT IF EXISTS "TrainingSkill_archivedById_fkey";

-- Accreditation
ALTER TABLE "Accreditation" DROP CONSTRAINT IF EXISTS "Accreditation_createdById_fkey";
ALTER TABLE "Accreditation" DROP CONSTRAINT IF EXISTS "Accreditation_archivedById_fkey";

-- ============================================================
-- 2. Drop the BackupCode and TrustedDevice tables
-- ============================================================

DROP TABLE IF EXISTS "BackupCode";
DROP TABLE IF EXISTS "TrustedDevice";

-- ============================================================
-- 3. Rename Employee.userId → Employee.identityId
-- ============================================================

-- Drop the unique index/constraint on userId if it exists
DROP INDEX IF EXISTS "Employee_userId_key";

-- Rename the column
ALTER TABLE "Employee" RENAME COLUMN "userId" TO "identityId";

-- Re-create the unique index with the new name
CREATE UNIQUE INDEX "Employee_identityId_key" ON "Employee"("identityId");

-- ============================================================
-- 4. Drop the User table
-- ============================================================

DROP TABLE IF EXISTS "User";
