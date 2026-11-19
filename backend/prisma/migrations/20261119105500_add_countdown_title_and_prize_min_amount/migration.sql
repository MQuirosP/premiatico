-- AlterTable (idempotent)
ALTER TABLE "Campaign"
    ADD COLUMN IF NOT EXISTS "countdownTitle" TEXT;

ALTER TABLE "CampaignPrize"
    ADD COLUMN IF NOT EXISTS "minOrderAmount" INTEGER;
