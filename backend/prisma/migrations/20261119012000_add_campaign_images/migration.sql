-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "CampaignImage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CampaignImage_campaignId_sortOrder_idx" ON "CampaignImage"("campaignId", "sortOrder");

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CampaignImage_campaignId_fkey'
    ) THEN
        ALTER TABLE "CampaignImage" ADD CONSTRAINT "CampaignImage_campaignId_fkey"
            FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing coverImageKey into CampaignImage if not already present
INSERT INTO "CampaignImage" ("id", "campaignId", "imageKey", "isCover", "sortOrder", "createdAt")
SELECT
    'mig_' || md5(c."id" || ':' || c."coverImageKey"),
    c."id",
    c."coverImageKey",
    true,
    0,
    CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."coverImageKey" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "CampaignImage" ci WHERE ci."campaignId" = c."id"
  );
