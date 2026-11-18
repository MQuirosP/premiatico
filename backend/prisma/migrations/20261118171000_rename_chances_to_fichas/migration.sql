-- Rename columns from chances to fichas without data loss
ALTER TABLE "Campaign" RENAME COLUMN "totalChances" TO "totalFichas";
ALTER TABLE "Combo" RENAME COLUMN "chanceQuantity" TO "fichaQuantity";
ALTER TABLE "OrderItem" RENAME COLUMN "chanceQuantitySnapshot" TO "fichaQuantitySnapshot";
