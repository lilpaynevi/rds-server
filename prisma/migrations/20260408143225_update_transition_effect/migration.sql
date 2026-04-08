/*
  Warnings:

  - The values [SLIDE_LEFT,SLIDE_RIGHT,SLIDE_UP,SLIDE_DOWN,ZOOM_IN,ZOOM_OUT] on the enum `TransitionEffect` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransitionEffect_new" AS ENUM ('FADE', 'SLIDE', 'ZOOM', 'NONE');
ALTER TABLE "public"."televisions" ALTER COLUMN "transition" DROP DEFAULT;
ALTER TABLE "televisions" ALTER COLUMN "transition" TYPE "TransitionEffect_new" USING ("transition"::text::"TransitionEffect_new");
ALTER TYPE "TransitionEffect" RENAME TO "TransitionEffect_old";
ALTER TYPE "TransitionEffect_new" RENAME TO "TransitionEffect";
DROP TYPE "public"."TransitionEffect_old";
ALTER TABLE "televisions" ALTER COLUMN "transition" SET DEFAULT 'FADE';
COMMIT;
