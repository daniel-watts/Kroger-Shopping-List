-- CreateTable
CREATE TABLE "KrogerCredential" (
    "userId" TEXT NOT NULL,
    "usernameEnc" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "storageStateEnc" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KrogerCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CouponSnapshot" (
    "userId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttlUntil" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponSnapshot_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "KrogerCredential" ADD CONSTRAINT "KrogerCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponSnapshot" ADD CONSTRAINT "CouponSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
