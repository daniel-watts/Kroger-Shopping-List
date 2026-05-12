-- CreateEnum
CREATE TYPE "ShoppingListItemStatus" AS ENUM ('pending', 'confirmed', 'stale', 'skipped');

-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "status" "ShoppingListItemStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "candidates" JSONB;

-- Backfill: pre-existing rows came from the old top-1 auto-match; preserve them
-- by marking matched ones 'confirmed' and unmatched ones 'skipped'.
UPDATE "ShoppingListItem" SET "status" = 'confirmed' WHERE "matchedProductId" IS NOT NULL;
UPDATE "ShoppingListItem" SET "status" = 'skipped' WHERE "matchedProductId" IS NULL;

-- CreateTable
CREATE TABLE "ItemMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "upc" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemMatch_userId_locationId_idx" ON "ItemMatch"("userId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemMatch_userId_locationId_normalizedQuery_key" ON "ItemMatch"("userId", "locationId", "normalizedQuery");

-- AddForeignKey
ALTER TABLE "ItemMatch" ADD CONSTRAINT "ItemMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
