-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WinnerSourceType" AS ENUM ('CAMPAIGN_MAIN', 'PRIZE', 'FLASH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WinnerDeliveryStatus" AS ENUM (
    'PENDING_CONTACT',
    'CONTACTED',
    'SCHEDULED',
    'DELIVERED',
    'UNCLAIMED',
    'REVERTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable CampaignCategory
CREATE TABLE IF NOT EXISTS "CampaignCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignCategory_slug_key" ON "CampaignCategory"("slug");

-- AlterTable Campaign
ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CampaignCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Seed default categories
INSERT INTO "CampaignCategory" ("id", "name", "slug", "isActive", "sortOrder")
VALUES
  ('cat_vehiculos', 'Vehículos', 'vehiculos', true, 1),
  ('cat_efectivo', 'Efectivo', 'efectivo', true, 2),
  ('cat_propiedades', 'Propiedades', 'propiedades', true, 3),
  ('cat_tecnologia', 'Tecnología', 'tecnologia', true, 4),
  ('cat_experiencias', 'Experiencias', 'experiencias', true, 5)
ON CONFLICT ("slug") DO NOTHING;

-- Backfill any existing Campaign.category values into CampaignCategory & link categoryId
INSERT INTO "CampaignCategory" ("id", "name", "slug", "isActive", "sortOrder")
SELECT
  'cat_' || md5(lower(trim("category"))),
  trim("category"),
  regexp_replace(
    translate(lower(trim("category")), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '-', 'g'
  ),
  true,
  10
FROM "Campaign"
WHERE trim("category") <> ''
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Campaign" c
SET "categoryId" = cat."id"
FROM "CampaignCategory" cat
WHERE c."categoryId" IS NULL
  AND cat."slug" = regexp_replace(
    translate(lower(trim(c."category")), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', '-', 'g'
  );

-- CreateTable DrawWinner
CREATE TABLE IF NOT EXISTS "DrawWinner" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "prizeId" TEXT,
  "orderId" TEXT,
  "sourceType" "WinnerSourceType" NOT NULL,
  "winningNumber" VARCHAR(5) NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatedById" TEXT,
  "deliveryStatus" "WinnerDeliveryStatus" NOT NULL DEFAULT 'PENDING_CONTACT',
  "contactedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "deliveryNotes" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawWinner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DrawWinner_campaignId_evaluatedAt_idx" ON "DrawWinner"("campaignId", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "DrawWinner_prizeId_idx" ON "DrawWinner"("prizeId");
CREATE INDEX IF NOT EXISTS "DrawWinner_deliveryStatus_evaluatedAt_idx" ON "DrawWinner"("deliveryStatus", "evaluatedAt");

DO $$ BEGIN
  ALTER TABLE "DrawWinner"
    ADD CONSTRAINT "DrawWinner_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "DrawWinner"
    ADD CONSTRAINT "DrawWinner_prizeId_fkey"
    FOREIGN KEY ("prizeId") REFERENCES "CampaignPrize"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "DrawWinner"
    ADD CONSTRAINT "DrawWinner_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Backfill existing evaluated Campaign winners
INSERT INTO "DrawWinner" ("id", "campaignId", "prizeId", "orderId", "sourceType", "winningNumber", "evaluatedAt", "deliveryStatus", "updatedAt")
SELECT
  'dw_camp_' || c."id",
  c."id",
  NULL,
  c."winningOrderId",
  'CAMPAIGN_MAIN'::"WinnerSourceType",
  c."winningNumber",
  c."winnerEvaluatedAt",
  CASE WHEN c."winningOrderId" IS NULL THEN 'UNCLAIMED'::"WinnerDeliveryStatus" ELSE 'PENDING_CONTACT'::"WinnerDeliveryStatus" END,
  CURRENT_TIMESTAMP
FROM "Campaign" c
WHERE c."winnerEvaluatedAt" IS NOT NULL
  AND c."winningNumber" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DrawWinner" dw
    WHERE dw."campaignId" = c."id" AND dw."prizeId" IS NULL AND dw."deliveryStatus" <> 'REVERTED'::"WinnerDeliveryStatus"
  );

-- Backfill existing evaluated CampaignPrize winners
INSERT INTO "DrawWinner" ("id", "campaignId", "prizeId", "orderId", "sourceType", "winningNumber", "evaluatedAt", "deliveryStatus", "updatedAt")
SELECT
  'dw_prize_' || p."id",
  p."campaignId",
  p."id",
  p."winningOrderId",
  CASE WHEN p."prizeType" = 'FLASH'::"PrizeCategory" THEN 'FLASH'::"WinnerSourceType" ELSE 'PRIZE'::"WinnerSourceType" END,
  p."winningNumber",
  p."winnerEvaluatedAt",
  CASE WHEN p."winningOrderId" IS NULL THEN 'UNCLAIMED'::"WinnerDeliveryStatus" ELSE 'PENDING_CONTACT'::"WinnerDeliveryStatus" END,
  CURRENT_TIMESTAMP
FROM "CampaignPrize" p
WHERE p."winnerEvaluatedAt" IS NOT NULL
  AND p."winningNumber" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DrawWinner" dw
    WHERE dw."prizeId" = p."id" AND dw."deliveryStatus" <> 'REVERTED'::"WinnerDeliveryStatus"
  );
