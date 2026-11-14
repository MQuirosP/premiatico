-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "enableInverseNumbers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReservationSession" ADD COLUMN     "packageCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "inverseAdditionsJson" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sinpeReceiverSnapshotJson" JSONB;

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sinpePhone" TEXT NOT NULL,
    "sinpeHolderName" TEXT NOT NULL,
    "sinpeBankName" TEXT,
    "sinpeInstructions" TEXT NOT NULL,
    "sinpeDetailNotice" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
