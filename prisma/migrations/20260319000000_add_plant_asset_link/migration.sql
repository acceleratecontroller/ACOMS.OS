-- CreateTable
CREATE TABLE "PlantAssetLink" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "notes" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMP(3),

    CONSTRAINT "PlantAssetLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantAssetLink_plantId_idx" ON "PlantAssetLink"("plantId");

-- CreateIndex
CREATE INDEX "PlantAssetLink_assetId_idx" ON "PlantAssetLink"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantAssetLink_plantId_assetId_linkedAt_key" ON "PlantAssetLink"("plantId", "assetId", "linkedAt");

-- AddForeignKey
ALTER TABLE "PlantAssetLink" ADD CONSTRAINT "PlantAssetLink_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantAssetLink" ADD CONSTRAINT "PlantAssetLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
