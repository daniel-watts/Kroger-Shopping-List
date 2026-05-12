-- Move locationId from KrogerOAuth to User.homeLocationId so the home-store
-- preference survives token-rotation deletes of the OAuth row.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeLocationId" TEXT;

-- Backfill from existing KrogerOAuth.locationId values.
UPDATE "User" u
SET "homeLocationId" = oauth."locationId"
FROM "KrogerOAuth" oauth
WHERE u."id" = oauth."userId" AND oauth."locationId" IS NOT NULL;

-- AlterTable
ALTER TABLE "KrogerOAuth" DROP COLUMN "locationId";
