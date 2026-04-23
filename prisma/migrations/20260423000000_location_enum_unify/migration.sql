-- Rename EmployeeLocation -> Location (now shared by Employee, Asset, Plant)
ALTER TYPE "EmployeeLocation" RENAME TO "Location";

-- Convert Asset.location from text to enum.
-- Validation has enforced these values via the API, but anything that
-- somehow doesn't match becomes NULL so the migration can't fail.
ALTER TABLE "Asset"
  ALTER COLUMN "location" TYPE "Location"
  USING (
    CASE
      WHEN "location" IN ('BRISBANE','BUNDABERG','HERVEY_BAY','MACKAY','OTHER')
        THEN "location"::"Location"
      ELSE NULL
    END
  );

-- Same for Plant.location
ALTER TABLE "Plant"
  ALTER COLUMN "location" TYPE "Location"
  USING (
    CASE
      WHEN "location" IN ('BRISBANE','BUNDABERG','HERVEY_BAY','MACKAY','OTHER')
        THEN "location"::"Location"
      ELSE NULL
    END
  );
