-- AlterTable: Add updatedById to Employee, Asset, and Plant
ALTER TABLE "Employee" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Asset" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Plant" ADD COLUMN "updatedById" TEXT;
