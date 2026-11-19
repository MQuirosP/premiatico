-- CreateEnum (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignDrawMode') THEN
        CREATE TYPE "CampaignDrawMode" AS ENUM ('SINGLE_WINNER', 'MULTI_PRIZE');
    END IF;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "Campaign"
    ADD COLUMN IF NOT EXISTS "drawMode" "CampaignDrawMode" NOT NULL DEFAULT 'SINGLE_WINNER';

-- Backfill: any campaign that already has individual prizes becomes MULTI_PRIZE
UPDATE "Campaign" c
SET "drawMode" = 'MULTI_PRIZE'
WHERE EXISTS (
    SELECT 1 FROM "CampaignPrize" p WHERE p."campaignId" = c."id"
);
