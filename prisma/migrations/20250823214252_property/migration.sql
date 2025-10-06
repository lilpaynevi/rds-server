-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "city" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "isVerify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roles" "public"."UserRole" NOT NULL DEFAULT 'USER';
