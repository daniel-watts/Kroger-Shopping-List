-- DropForeignKey
ALTER TABLE "KrogerCredential" DROP CONSTRAINT "KrogerCredential_userId_fkey";

-- DropForeignKey
ALTER TABLE "CouponSnapshot" DROP CONSTRAINT "CouponSnapshot_userId_fkey";

-- DropTable
DROP TABLE "KrogerCredential";

-- DropTable
DROP TABLE "CouponSnapshot";
