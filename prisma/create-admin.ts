/**
 * Crée (ou promeut) un compte administrateur.
 *
 * Les administrateurs sont la cible des notifications de nouvelle demande de
 * compte et les seuls habilités à valider un compte : sans au moins un compte
 * ADMIN en base, aucune inscription ne peut être approuvée.
 *
 * `role` fait foi côté application ; `roles` est l'ancienne colonne synonyme,
 * écrite en parallèle pour que les deux restent alignées tant qu'elle existe.
 *
 * Usage :
 *   ADMIN_EMAIL=admin@rds.fr ADMIN_PASSWORD='MotDePasse1' \
 *   ADMIN_FIRSTNAME=Jean ADMIN_LASTNAME=Dupont \
 *   npx ts-node prisma/create-admin.ts
 *
 * Le script est idempotent : relancé sur un e-mail existant, il se contente de
 * passer le compte en ADMIN + isVerify sans toucher au mot de passe.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRSTNAME ?? 'Admin';
  const lastName = process.env.ADMIN_LASTNAME ?? 'RDS Connect';

  if (!email) {
    throw new Error('ADMIN_EMAIL est requis');
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: { roles: 'ADMIN', role: 'ADMIN', isVerify: true, isActive: true },
      select: { id: true, email: true, roles: true },
    });
    console.log('Compte existant promu administrateur :', updated);
    return;
  }

  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD est requis pour créer un nouveau compte administrateur',
    );
  }

  const created = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: await bcrypt.hash(password, 10),
      roles: 'ADMIN',
      role: 'ADMIN',
      // Un administrateur n'a personne pour le valider : il est actif d'emblée.
      isVerify: true,
      isActive: true,
    },
    select: { id: true, email: true, roles: true },
  });

  console.log('Administrateur créé :', created);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
