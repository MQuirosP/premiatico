-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PrizeCategory" AS ENUM ('MAIN', 'FLASH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrizeAmountScope" AS ENUM ('PER_ORDER', 'CUSTOMER_TOTAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrizeDrawWeightMode" AS ENUM ('PER_TICKET', 'PER_CUSTOMER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "CampaignPrize"
  ADD COLUMN IF NOT EXISTS "prizeType" "PrizeCategory" NOT NULL DEFAULT 'MAIN',
  ADD COLUMN IF NOT EXISTS "amountScope" "PrizeAmountScope" NOT NULL DEFAULT 'PER_ORDER',
  ADD COLUMN IF NOT EXISTS "minTickets" INTEGER,
  ADD COLUMN IF NOT EXISTS "purchaseFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "purchaseUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requiredComboId" TEXT,
  ADD COLUMN IF NOT EXISTS "orderChannel" "OrderChannel",
  ADD COLUMN IF NOT EXISTS "drawWeightMode" "PrizeDrawWeightMode" NOT NULL DEFAULT 'PER_TICKET';
