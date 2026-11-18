-- Idempotently rename columns from chances to fichas without data loss
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Campaign' AND column_name = 'totalChances'
  ) THEN
    ALTER TABLE "Campaign" RENAME COLUMN "totalChances" TO "totalFichas";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CampaignCombo' AND column_name = 'chanceQuantity'
  ) THEN
    ALTER TABLE "CampaignCombo" RENAME COLUMN "chanceQuantity" TO "fichaQuantity";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'chanceQuantitySnapshot'
  ) THEN
    ALTER TABLE "OrderItem" RENAME COLUMN "chanceQuantitySnapshot" TO "fichaQuantitySnapshot";
  END IF;
END $$;
