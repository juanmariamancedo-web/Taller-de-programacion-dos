/*
  Warnings:

  - You are about to drop the column `reservedStock` on the `products` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_client_id_fkey";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "reservedStock",
ADD COLUMN     "reserved_stock" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
