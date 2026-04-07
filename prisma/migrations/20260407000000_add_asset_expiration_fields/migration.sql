-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "expires" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "expirationDate" TIMESTAMP(3);
