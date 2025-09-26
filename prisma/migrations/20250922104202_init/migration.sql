/*
  Warnings:

  - You are about to drop the `data_transfers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "data_transfers" DROP CONSTRAINT "data_transfers_cp_id_fkey";

-- DropTable
DROP TABLE "data_transfers";
