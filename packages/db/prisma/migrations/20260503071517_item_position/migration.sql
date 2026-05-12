-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill positions for existing rows by createdAt order within each list.
UPDATE "ShoppingListItem" t
SET "position" = sub.pos - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "listId" ORDER BY "createdAt", "id"
  ) AS pos
  FROM "ShoppingListItem"
) sub
WHERE t.id = sub.id;

-- DropIndex
DROP INDEX "ShoppingListItem_listId_idx";

-- CreateIndex
CREATE INDEX "ShoppingListItem_listId_position_idx" ON "ShoppingListItem"("listId", "position");
