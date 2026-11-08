/*
  Warnings:

  - You are about to drop the column `reserved_stock` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `stock_reservations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stock_reservations" DROP CONSTRAINT "stock_reservations_order_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_reservations" DROP CONSTRAINT "stock_reservations_product_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "reserved_stock";

-- DropTable
DROP TABLE "stock_reservations";
