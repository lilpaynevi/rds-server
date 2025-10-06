/*
  Warnings:

  - Added the required column `stripeUrl` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "stripeUrl" TEXT NOT NULL;
