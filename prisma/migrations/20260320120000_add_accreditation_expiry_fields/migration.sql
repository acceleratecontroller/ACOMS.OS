-- AlterTable: add expiry/renewal fields to Accreditation
ALTER TABLE "Accreditation" ADD COLUMN "expires" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Accreditation" ADD COLUMN "renewalMonths" INTEGER;
ALTER TABLE "Accreditation" ADD COLUMN "renewalNotes" TEXT;
