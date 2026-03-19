-- AlterTable: Update Plant register fields
-- Remove "name" column, rename serialNumber/purchaseCost/yearOfManufacture/notes,
-- and add new tracking fields.

ALTER TABLE "Plant" DROP COLUMN "name";
ALTER TABLE "Plant" RENAME COLUMN "serialNumber" TO "vinNumber";
ALTER TABLE "Plant" RENAME COLUMN "purchaseCost" TO "purchasePrice";
ALTER TABLE "Plant" RENAME COLUMN "yearOfManufacture" TO "year";
ALTER TABLE "Plant" RENAME COLUMN "notes" TO "comments";

ALTER TABLE "Plant" ADD COLUMN "stateRegistered" TEXT;
ALTER TABLE "Plant" ADD COLUMN "licenceType" TEXT;
ALTER TABLE "Plant" ADD COLUMN "regionAssigned" TEXT;
ALTER TABLE "Plant" ADD COLUMN "ampolCardNumber" TEXT;
ALTER TABLE "Plant" ADD COLUMN "ampolCardExpiry" TIMESTAMP(3);
ALTER TABLE "Plant" ADD COLUMN "linktTagNumber" TEXT;
ALTER TABLE "Plant" ADD COLUMN "fleetDynamicsSerialNumber" TEXT;
ALTER TABLE "Plant" ADD COLUMN "coiExpirationDate" TIMESTAMP(3);
ALTER TABLE "Plant" ADD COLUMN "soldDate" TIMESTAMP(3);
ALTER TABLE "Plant" ADD COLUMN "soldPrice" DECIMAL(65,30);
