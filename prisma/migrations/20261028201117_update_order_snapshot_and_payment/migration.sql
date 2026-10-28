/*
  Warnings:

  - You are about to drop the `payment_methods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_statuses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tracking_number]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_payment_method_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_payment_status_id_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_method" TEXT NOT NULL DEFAULT 'Efectivo',
ADD COLUMN     "shipping_apartment" TEXT,
ADD COLUMN     "shipping_city_name" TEXT,
ADD COLUMN     "shipping_floor" TEXT,
ADD COLUMN     "shipping_number" INTEGER,
ADD COLUMN     "shipping_postal_code" TEXT,
ADD COLUMN     "shipping_street" TEXT;

-- DropTable
DROP TABLE "payment_methods";

-- DropTable
DROP TABLE "payment_statuses";

-- DropTable
DROP TABLE "payments";

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_number_key" ON "orders"("tracking_number");
