-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN "winningNumber" VARCHAR(5),
ADD COLUMN "winningOrderId" TEXT,
ADD COLUMN "winnerEvaluatedAt" TIMESTAMP(3),
ADD COLUMN "winnerNotes" TEXT;
