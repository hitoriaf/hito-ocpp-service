/*
  Warnings:

  - You are about to drop the column `context` on the `meter_values` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `meter_values` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `meter_values` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "meter_values" DROP COLUMN "context",
DROP COLUMN "format",
DROP COLUMN "location";
