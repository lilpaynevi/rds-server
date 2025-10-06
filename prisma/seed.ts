import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const seed = await prisma.subscriptionPlan.createMany({
    data: [
      // {
      //   name: 'Abonnement RDS Connect',
      //   description:
      //     "Profitez d'un mois offert lors de la souscription d'un an complet",
      //   stripeProductId: 'prod_T3VwnfHNT2iwuO',
      //   stripePriceId: 'price_1S7OuqAQxGgWdn2vTmQFwkQs',
      //   price: 30.0,
      //   interval: 'mouth',
      // },
      {
        name: 'Option Ecran supplémentaire',
        description:
          "Profitez d'un mois offert lors de la souscription d'un an complet",
        stripeProductId: 'prod_T3VxhrYWMoBxlt',
        stripePriceId: 'price_1S7OvoAQxGgWdn2vEKo3nksD',
        price: 500.0,
        interval: 'onetime',
      },
      // {
      //   name: 'Abonnement Annuel',
      //   description:
      //     "Profitez d'un mois offert lors de la souscription d'un an complet",
      //   stripeProductId: 'prod_T3ksqDM0hP6MSO',
      //   stripePriceId: 'price_1S7dNCAQxGgWdn2vUVFHeO6S',
      //   price: 33000.0,
      //   interval: 'year',
      // },
    ],
  });

  console.log(seed);
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
