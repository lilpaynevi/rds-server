-- AlterTable
ALTER TABLE "public"."schedules" ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "endDate" DROP NOT NULL;
