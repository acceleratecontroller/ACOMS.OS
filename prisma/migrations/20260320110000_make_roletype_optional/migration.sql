-- AlterTable: make roleType nullable (replaced by EmployeeRole assignments)
ALTER TABLE "Employee" ALTER COLUMN "roleType" DROP NOT NULL;
