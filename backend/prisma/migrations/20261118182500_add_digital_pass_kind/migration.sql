-- Add DigitalPassKind enum and kind column to DigitalPass
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DigitalPassKind') THEN
    CREATE TYPE "DigitalPassKind" AS ENUM ('PASS', 'FICHA');
  END IF;
END $$;

ALTER TABLE "DigitalPass"
  ADD COLUMN IF NOT EXISTS "kind" "DigitalPassKind" NOT NULL DEFAULT 'PASS';
