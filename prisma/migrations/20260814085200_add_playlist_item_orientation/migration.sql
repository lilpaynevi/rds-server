-- CreateEnum
CREATE TYPE "MediaOrientation" AS ENUM ('AUTO', 'LANDSCAPE', 'PORTRAIT');

-- AlterTable
ALTER TABLE "playlist_items" ADD COLUMN     "orientation" "MediaOrientation" NOT NULL DEFAULT 'AUTO';
