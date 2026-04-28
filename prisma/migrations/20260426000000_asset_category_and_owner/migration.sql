-- Replace Asset.category (free text) with a relation to a new AssetCategory
-- lookup table, and add optional external ownership via a new AssetOwner
-- table. Existing distinct category values are migrated as-is so nothing
-- is lost; admins can rename / merge them via the UI afterwards.

-- ============================================================
-- 1. Lookup tables
-- ============================================================
CREATE TABLE "AssetCategory" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetCategory_name_key" ON "AssetCategory"("name");

CREATE TABLE "AssetOwner" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetOwner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetOwner_name_key" ON "AssetOwner"("name");

-- ============================================================
-- 2. Backfill AssetCategory from any distinct existing values
-- ============================================================
INSERT INTO "AssetCategory" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "category", NOW(), NOW()
FROM (SELECT DISTINCT "category" FROM "Asset" WHERE "category" IS NOT NULL AND "category" <> '') d;

-- ============================================================
-- 3. Add Asset.categoryId, populate from the old text column,
--    then drop the text column.
-- ============================================================
ALTER TABLE "Asset" ADD COLUMN "categoryId" TEXT;

UPDATE "Asset" a
SET "categoryId" = ac."id"
FROM "AssetCategory" ac
WHERE a."category" = ac."name";

-- Anything that didn't match (shouldn't happen, but defensive) gets caught:
-- if any row still has a NULL categoryId, we'd fail the NOT NULL constraint.
-- Make NOT NULL only after the update.
ALTER TABLE "Asset" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "AssetCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

ALTER TABLE "Asset" DROP COLUMN "category";

-- ============================================================
-- 4. External ownership columns on Asset
-- ============================================================
ALTER TABLE "Asset" ADD COLUMN "externallyOwned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "externalOwnerId" TEXT;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_externalOwnerId_fkey"
  FOREIGN KEY ("externalOwnerId") REFERENCES "AssetOwner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Asset_externalOwnerId_idx" ON "Asset"("externalOwnerId");
