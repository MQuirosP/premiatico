-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEB', 'PARTNER');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PARTNER_POS';

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "externalBancaId" TEXT,
ADD COLUMN     "externalSellerId" TEXT,
ADD COLUMN     "externalSellerName" TEXT,
ADD COLUMN     "externalVentanaId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "partnerCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

