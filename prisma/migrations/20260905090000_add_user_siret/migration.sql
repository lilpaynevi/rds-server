-- AlterTable
ALTER TABLE "users" ADD COLUMN "siret" TEXT;

-- CreateIndex
-- Postgres autorise plusieurs NULL dans un index unique : les comptes créés
-- avant l'ouverture aux seuls professionnels (siret NULL) ne s'excluent pas.
CREATE UNIQUE INDEX "users_siret_key" ON "users"("siret");
