-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "stock" SET DEFAULT 0;
