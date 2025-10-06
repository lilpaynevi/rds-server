// src/stripe/stripe.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import bcrypt from 'bcrypt';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SK_KEY);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * 🎯 Gestionnaire principal des webhooks
   */
  async handleWebhook(event) {
    try {
      this.logger.log(`📨 Webhook reçu: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed':
          return this.assignedSubscriptionToUser(event);
        case 'invoice.payment_succeeded':
          return 'this.handlePaymentSucceeded : ' + event;
          break;

        case 'invoice.payment_failed':
          (await 'this.handlePaymentFailed(event.data.object as Stripe.Invoice) : ') +
            event;
          break;

        case 'customer.subscription.created':
          //
          return true;
          break;

        case 'invoice.paid':
          return '';
          break;

        case 'customer.subscription.deleted':
          (await 'this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription) : ') +
            event;
          break;

        default:
          this.logger.warn(`⚠️ Événement non géré: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`❌ Erreur webhook: ${error.message}`);
      throw error;
    }
  }

  async assignedSubscriptionToUser(event) {
    console.log('Assignation en cours ....');
    console.log('Event : ', event);

    let data = event.data.object;
    console.log('Event data : ', data);

    const custom_fields = data.custom_fields?.map((field) => ({
      key: field.key,
      label: field.label.custom,
      value: field.text.value,
    }));

    const email = data.customer_email;
    const subscriptionId = data.subscription;
    const customerId = data.customer;
    const invoiceId = data.invoice;
    const sessionId = data.id;

    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['lines.data.price.product'],
      });

      const planStripeId = invoice.lines.data[0].pricing.price_details.product;
      const periodStart = new Date(invoice.lines.data[0].period.start * 1000);
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);

      const quantity = invoice.lines.data[0].quantity || 1;

      console.log('🚀 ~ StripeService ~ données extraites:', {
        email,
        subscriptionId,
        planStripeId,
        periodStart,
        periodEnd,
        quantity,
        custom_fields,
      });

      // Récupérer l'utilisateur
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error(`User not found with email: ${email}`);
      }

      // Récupérer le plan d'abonnement
      const subscriptionPlan = await this.prisma.subscriptionPlan.findUnique({
        where: {
          stripeProductId: planStripeId,
        },
        include: {
          parentPlan: true,
          options: true,
        },
      });

      if (!subscriptionPlan) {
        throw new Error(
          `Subscription plan not found with stripeProductId: ${planStripeId}`,
        );
      }

      // Vérifier si l'abonnement existe déjà
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: {
          stripeSubscriptionId: subscriptionId,
        },
        include: {
          plan: true,
        },
      });

      if (existingSubscription) {
        console.log('Abonnement déjà existant:', existingSubscription.id);
        return {
          success: true,
          subscriptionId: existingSubscription.id,
          message: 'Subscription already exists',
        };
      }

      // 🔥 DISTINCTION IMPORTANTE : Plan principal vs Option
      if (subscriptionPlan.planType === 'OPTION') {
        // ✅ C'est une OPTION - Ne pas toucher à l'abonnement principal
        console.log(
          "🎯 Traitement d'une OPTION - Abonnement principal préservé",
        );
        return await this.handleOptionSubscription(
          user,
          subscriptionPlan,
          subscriptionId,
          periodStart,
          periodEnd,
          quantity,
          custom_fields,
          customerId,
          sessionId,
          invoiceId,
          data,
        );
      } else {
        // ✅ C'est un PLAN PRINCIPAL - Gérer le changement de plan si nécessaire
        console.log("🎯 Traitement d'un PLAN PRINCIPAL");
        return await this.handleMainSubscription(
          user,
          subscriptionPlan,
          subscriptionId,
          periodStart,
          periodEnd,
          quantity,
          custom_fields,
          customerId,
          sessionId,
          invoiceId,
        );
      }
    } catch (err) {
      console.error("Erreur lors de la gestion de l'abonnement:", err);
      throw err;
    }
  }

  // Gérer les abonnements principaux (avec gestion intelligente des changements)
  async handleMainSubscription(
    user,
    subscriptionPlan,
    subscriptionId,
    periodStart,
    periodEnd,
    quantity,
    custom_fields,
    customerId,
    sessionId,
    invoiceId,
  ) {
    console.log(
      "🔄 Gestion d'un abonnement principal avec quantité:",
      quantity,
    );

    // ✅ CORRECTION : Calculer correctement les écrans de base
    const baseMaxScreens = subscriptionPlan.maxScreens || 1;
    // ❌ const totalMaxScreens = baseMaxScreens + quantity;
    // ✅ Pour un plan principal, la quantité multiplie les écrans de base
    const totalMaxScreens = baseMaxScreens * quantity;

    console.log('📊 Calcul plan principal:', {
      baseMaxScreens,
      quantity,
      totalMaxScreens,
      formula: `${baseMaxScreens} × ${quantity} = ${totalMaxScreens}`,
    });

    // Vérifier s'il y a déjà un abonnement principal actif
    const existingMainSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        plan: {
          planType: 'MAIN',
        },
      },
      include: {
        plan: true,
      },
    });

    if (existingMainSubscription) {
      console.log('⚠️ Changement de plan principal détecté');
      console.log('Ancien plan:', existingMainSubscription.plan.name);
      console.log('Nouveau plan:', subscriptionPlan.name);

      // Annuler uniquement l'ancien abonnement principal
      await this.prisma.subscription.update({
        where: { id: existingMainSubscription.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          endedAt: new Date(),
          metadata: {
            cancelReason: 'PLAN_CHANGE',
            replacedBy: subscriptionId,
          },
        },
      });

      console.log('✅ Ancien plan principal annulé (options préservées)');
    }

    // Créer le nouvel abonnement principal
    const subscriptionCreate = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: subscriptionId,
        planId: subscriptionPlan.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: 'ACTIVE',
        currentMaxScreens: totalMaxScreens,
        usedScreens: 0,
        quantity: quantity,
        metadata: {
          customFields: custom_fields,
          stripeCustomerId: customerId,
          checkoutSessionId: sessionId,
          invoiceId: invoiceId,
          planType: 'MAIN',
          quantityDetails: {
            baseMaxScreens,
            quantity,
            totalMaxScreens,
            calculation: `${baseMaxScreens} × ${quantity}`,
          },
          replacedSubscription: existingMainSubscription?.id || null,
        },
      },
      include: {
        plan: true,
      },
    });

    // ✅ Recalculer les limites totales en incluant les options existantes
    const updatedSubscription = await this.updateMainSubscriptionLimits(
      subscriptionCreate.id,
      user.id,
    );

    console.log('✅ Nouvel abonnement principal créé:', {
      subscriptionId: subscriptionCreate.id,
      baseScreens: totalMaxScreens,
      finalScreensWithOptions: updatedSubscription.currentMaxScreens,
      quantity: quantity,
    });

    return {
      success: true,
      subscriptionId: subscriptionCreate.id,
      userId: user.id,
      planId: subscriptionPlan.id,
      type: 'MAIN',
      action: existingMainSubscription ? 'PLAN_CHANGED' : 'NEW_SUBSCRIPTION',
      quantity: quantity,
      currentMaxScreens: updatedSubscription.currentMaxScreens,
      customFields: custom_fields,
    };
  }

  // Gérer les options (SANS toucher à l'abonnement principal)
  async handleOptionSubscription(
    user,
    subscriptionPlan,
    subscriptionId,
    periodStart,
    periodEnd,
    quantity,
    custom_fields,
    customerId,
    sessionId,
    invoiceId,
    stripeData,
  ) {
    console.log("➕ Ajout d'une OPTION (abonnement principal préservé)");
    console.log('Option:', subscriptionPlan.name, 'Quantité:', quantity);

    // ✅ Vérifier qu'il existe un abonnement principal actif
    const mainSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        plan: {
          planType: 'MAIN',
        },
      },
      include: {
        plan: true,
      },
    });

    if (!mainSubscription) {
      throw new Error(
        `Impossible d'ajouter une option sans abonnement principal actif. 
      Utilisateur: ${user.email}`,
      );
    }

    console.log('✅ Abonnement principal trouvé:', {
      id: mainSubscription.id,
      plan: mainSubscription.plan.name,
      currentMaxScreens: mainSubscription.currentMaxScreens,
    });

    // ✅ CORRECTION IMPORTANTE : Pour les options, la quantité = nombre d'écrans ajoutés
    // ❌ const additionalScreensPerUnit = subscriptionPlan.maxScreens || 0;
    // ❌ const totalAdditionalScreens = additionalScreensPerUnit + quantity;

    // ✅ Pour une option, quantity = nombre direct d'écrans à ajouter
    const totalAdditionalScreens = quantity;

    console.log("📊 Ressources de l'option:", {
      optionName: subscriptionPlan.name,
      quantity: quantity,
      totalAdditionalScreens: totalAdditionalScreens,
      explanation:
        "La quantité représente directement le nombre d'écrans ajoutés",
    });

    // ✅ Créer l'abonnement pour l'option (en tant qu'add-on)
    const optionSubscription = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: subscriptionId,
        planId: subscriptionPlan.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: 'ACTIVE',
        currentMaxScreens: totalAdditionalScreens, // Nombre d'écrans apportés par cette option
        usedScreens: 0,
        quantity: quantity,
        metadata: {
          customFields: custom_fields,
          stripeCustomerId: customerId,
          checkoutSessionId: sessionId,
          invoiceId: invoiceId,
          planType: 'OPTION',
          parentSubscriptionId: mainSubscription.id,
          optionDetails: {
            type: subscriptionPlan.name,
            quantity: quantity,
            screensAdded: totalAdditionalScreens,
            calculation: `+${quantity} écrans`,
          },
          addedAt: new Date(),
        },
      },
      include: {
        plan: true,
      },
    });

    // ✅ Mettre à jour les limites de l'abonnement principal (cumul avec les options)
    const updatedMainSubscription = await this.updateMainSubscriptionLimits(
      mainSubscription.id,
      user.id,
    );

    console.log('🎉 Option ajoutée avec succès:', {
      optionSubscriptionId: optionSubscription.id,
      mainSubscriptionId: mainSubscription.id,
      addedScreens: totalAdditionalScreens,
      previousTotalScreens: mainSubscription.currentMaxScreens,
      newTotalScreens: updatedMainSubscription.currentMaxScreens,
      optionQuantity: quantity,
    });

    // Récupérer toutes les options actives pour info
    const allActiveOptions = await this.prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        plan: { planType: 'OPTION' },
      },
      include: { plan: true },
    });

    return {
      success: true,
      subscriptionId: optionSubscription.id,
      mainSubscriptionId: mainSubscription.id,
      userId: user.id,
      planId: subscriptionPlan.id,
      type: 'OPTION',
      action: 'OPTION_ADDED',
      quantity: quantity,
      additionalScreens: totalAdditionalScreens,
      previousTotalScreens: mainSubscription.currentMaxScreens,
      newTotalMaxScreens: updatedMainSubscription.currentMaxScreens,
      activeOptionsCount: allActiveOptions.length,
      customFields: custom_fields,
      message: `Option ${subscriptionPlan.name} (${quantity} écrans) ajoutée avec succès.`,
    };
  }

  // Fonction inchangée mais avec logs améliorés
  async updateMainSubscriptionLimits(mainSubscriptionId, userId) {
    console.log("🔄 Mise à jour des limites de l'abonnement principal...");

    const mainSubscription = await this.prisma.subscription.findUnique({
      where: { id: mainSubscriptionId },
      include: { plan: true },
    });

    if (!mainSubscription) {
      throw new Error('Abonnement principal non trouvé');
    }

    // Récupérer toutes les options actives
    const activeOptions = await this.prisma.subscription.findMany({
      where: {
        userId: userId,
        status: 'ACTIVE',
        plan: { planType: 'OPTION' },
      },
      include: { plan: true },
    });

    console.log('📋 Options actives trouvées:', activeOptions.length);

    // ✅ CORRECTION : Écrans de base du plan principal
    const mainPlanBaseScreens =
      (mainSubscription.plan.maxScreens || 1) * mainSubscription.quantity;

    // ✅ CORRECTION : Écrans des options (quantity = écrans ajoutés directement)
    let totalAdditionalScreens = 0;
    activeOptions.forEach((option) => {
      // ❌ const screensFromOption = (option.plan.maxScreens || 0) + option.quantity;
      // ✅ Pour les options, quantity = nombre d'écrans ajoutés
      const screensFromOption = option.quantity;
      totalAdditionalScreens += screensFromOption;

      console.log('  📌 Option:', {
        name: option.plan.name,
        quantity: option.quantity,
        screensAdded: screensFromOption,
        note: 'quantity = écrans ajoutés directement',
      });
    });

    const finalMaxScreens = mainPlanBaseScreens + totalAdditionalScreens;

    console.log('🎯 Calcul final:', {
      mainPlanScreens: mainPlanBaseScreens,
      calculation: `${mainSubscription.plan.maxScreens} × ${mainSubscription.quantity}`,
      optionsScreens: totalAdditionalScreens,
      total: finalMaxScreens,
      formula: `${mainPlanBaseScreens} + ${totalAdditionalScreens} = ${finalMaxScreens}`,
    });

    // Mise à jour
    const updatedSubscription = await this.prisma.subscription.update({
      where: { id: mainSubscriptionId },
      data: {
        currentMaxScreens: finalMaxScreens,
        metadata: {
          limitsCalculation: {
            baseScreens: mainPlanBaseScreens,
            baseCalculation: `${mainSubscription.plan.maxScreens} × ${mainSubscription.quantity}`,
            optionsScreens: totalAdditionalScreens,
            totalScreens: finalMaxScreens,
            activeOptionsCount: activeOptions.length,
            lastCalculated: new Date(),
          },
          activeOptions: activeOptions.map((opt) => ({
            id: opt.id,
            planName: opt.plan.name,
            quantity: opt.quantity,
            screensAdded: opt.quantity, // ✅ Quantité = écrans ajoutés
          })),
        },
      },
    });

    console.log('✅ Limites mises à jour avec succès');
    return updatedSubscription;
  }

  async findOne(id: string) {
    return this.prisma.subscriptionPlan.findUnique({
      where: {
        id,
      },
    });
  }

  async findAll() {
    const ppp = await this.prisma.subscriptionPlan.findMany();
    return ppp;
  }
  async createCheckoutSession(data: any) {
    try {
      const line_items = [
        {
          price: data.priceId,
          quantity: data.data.quantity ? data.data.quantity : 1,
        },
      ];
      console.log(
        '🚀 ~ StripeService ~ createCheckoutSession ~ line_items:',
        line_items,
      );

      console.log(
        process.env.STRIPE_SUCCESS_URL,
        process.env.STRIPE_CANCEL_URL,
        data.data.email,
      );

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card', 'paypal'], // Consider adding "paypal", "apple_pay", "google_pay" if applicable
        line_items,
        mode: 'subscription',
        metadata: {
          firstName: data.data.firstName,
          lastName: data.data.lastName,
          company: data.data.company,
          email: data.data.email,
        },
        customer_email: data.data.email,

        // custom_fields: [
        //   {
        //     key: 'company',
        //     label: {
        //       type: 'custom',
        //       custom: `Nom de l'entreprise concerné`,
        //     },
        //     type: 'text',
        //   },
        //   {
        //     key: 'department',
        //     label: {
        //       type: 'custom',
        //       custom: `Ex: Seine-et-Marne`,
        //     },
        //     type: 'text',
        //   },
        // ],
        // success_url: process.env.STRIPE_SUCCESS_URL + "?session_id={CHECKOUT_SESSION_ID}",
        success_url: process.env.STRIPE_SUCCESS_URL,
        cancel_url: process.env.STRIPE_CANCEL_URL,
      });

      return { id: session.id, url: session.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { status: 404, error };
    }
  }

  async createPaymentIntent(subPlanId: string) {
    const searchPlanId = await this.prisma.subscriptionPlan.findUnique({
      where: {
        id: subPlanId,
      },
    });

    if (!searchPlanId) {
      throw new Error('Abonnement non existant');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Number(searchPlanId.price + '00'),
        currency: 'eur',
        payment_method_types: ['card', 'paypal'],
        description: searchPlanId.description,
      });

      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error('Erreur Stripe:', error);
      return { error: error.message };
    }
  }

  async createCheckoutWithRegistration(
    planData: any,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
  ) {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: planData.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',

        // ✅ Stocker les données utilisateur en metadata
        metadata: {
          registration_pending: 'true',
          user_first_name: userData.firstName,
          user_last_name: userData.lastName,
          user_email: userData.email,
          user_password_hash: await this.hashPassword(userData.password), // Hash le mot de passe
          plan_name: planData.planName,
        },

        customer_email: userData.email,

        success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.STRIPE_CANCEL_URL}?reason=cancelled`,
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    } catch (error) {
      this.logger.error('Erreur création checkout avec registration:', error);
      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }
}
