-- AlterTable
ALTER TABLE "CampaignPrize" ADD COLUMN     "drawAt" TIMESTAMP(3),
ADD COLUMN     "drawReference" TEXT,
ADD COLUMN     "winnerEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "winnerNotes" TEXT,
ADD COLUMN     "winningNumber" VARCHAR(5),
ADD COLUMN     "winningOrderId" TEXT;

-- AddForeignKey
ALTER TABLE "CampaignPrize" ADD CONSTRAINT "CampaignPrize_winningOrderId_fkey" FOREIGN KEY ("winningOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
