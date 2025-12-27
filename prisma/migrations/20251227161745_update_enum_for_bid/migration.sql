-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('open', 'specific');

-- AlterTable
ALTER TABLE "BidSession" ADD COLUMN     "bidType" "BidType",
ADD COLUMN     "maxBudget" INTEGER,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "selectedPackageId" TEXT;

-- AddForeignKey
ALTER TABLE "BidSession" ADD CONSTRAINT "BidSession_selectedPackageId_fkey" FOREIGN KEY ("selectedPackageId") REFERENCES "InstallerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
