/*
  Warnings:

  - A unique constraint covering the columns `[userId,planId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PlanType" AS ENUM ('MAIN', 'OPTION');

-- AlterTable
ALTER TABLE "public"."subscription_plans" ADD COLUMN     "parentPlanId" TEXT,
ADD COLUMN     "planType" "public"."PlanType" NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "public"."subscriptions" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_planId_key" ON "public"."subscriptions"("userId", "planId");

-- AddForeignKey
ALTER TABLE "public"."subscription_plans" ADD CONSTRAINT "subscription_plans_parentPlanId_fkey" FOREIGN KEY ("parentPlanId") REFERENCES "public"."subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
