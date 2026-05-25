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

        case 'customer.subscription.updated':
          //
          return this.customerSubscriptionUpdated(event);
          break;

        case 'invoice.paid':
          return this.receiveInvoicePaid(event);
          break;

        case 'invoice_payment.paid':
          return this.receiveInvoicePaid(event);
          break;

        case 'customer.subscription.deleted':
          return this.handleCustomerSubscriptionDeleted(event);
        default:
          this.logger.warn(`⚠️ Événement non géré: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`❌ Erreur webhook: ${error.message}`);
      throw error;
    }
  }

  async receiveInvoicePaid(event) {
    try {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceURL = invoice.hosted_invoice_url;
      const user_email = invoice.customer_email;
      const subscriptionId = String(
        invoice.parent.subscription_details.subscription,
      );

      var searchUser = await this.prisma.user.findUnique({
        where: {
          email: user_email,
        },
      });

      if (!searchUser) {
        return 'Pas d user found';
      }

      var setInvoice = await this.prisma.invoice.create({
        data: {
          userId: searchUser.id,
          subscriptionId,
          stripeUrl: invoiceURL,
        },
      });

      return setInvoice;
    } catch (err) {
      console.log(err);

      return err;
    }
  }

  async handleCustomerSubscriptionDeleted(event) {
    try {
      const subscription = event.data.object as Stripe.Subscription;

      console.log('🚀 ~ handleSubscriptionCanceled ~ subscription:', {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
        canceled_at: subscription.canceled_at,
        ended_at: subscription.ended_at,
      });

      // Récupérer l'utilisateur par stripeSubscriptionId
      const userSubscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id, status: 'ACTIVE' },
        include: { user: true, plan: true },
      });

      if (!userSubscription) {
        console.error(`❌ Subscription not found: ${subscription.id}`);
        return;
      }

      console.log('📋 ~ Subscription details:', {
        userId: userSubscription.user.id,
        planType: userSubscription.plan.planType,
        planName: userSubscription.plan.name,
      });

      // Si c'est un plan MAIN, annuler aussi les options associées
      if (userSubscription.plan.planType === 'MAIN') {
        console.log('🔍 ~ Checking for option subscriptions...');

        const optionSubscriptions = await this.prisma.subscription.findFirst({
          where: {
            userId: userSubscription.user.id,
            plan: {
              planType: 'OPTION',
            },
            status: {
              notIn: ['CANCELED'], // Ne pas annuler ce qui est déjà annulé
            },
          },
          include: {
            plan: true,
          },
        });

        try {
          if (optionSubscriptions) {
            if (optionSubscriptions.stripeSubscriptionId) {
              console.log(
                `🗑️ ~ Canceling option subscription: ${optionSubscriptions.stripeSubscriptionId}`,
              );

              await this.stripe.subscriptions.cancel(
                optionSubscriptions.stripeSubscriptionId,
              );

              await this.prisma.subscription.update({
                where: { id: optionSubscriptions.id },
                data: {
                  status: 'CANCELED',
                  canceledAt: new Date(),
                  endedAt: new Date(),
                },
              });

              console.log(
                `✅ ~ Option subscription canceled: ${optionSubscriptions.id}`,
              );
            }
          }
        } catch (error) {
          console.error(
            `❌ ~ Error canceling option ${optionSubscriptions.id}:`,
            error.message,
          );
        }
      }

      // Mettre à jour le statut de l'abonnement principal
      const endDate = subscription.ended_at
        ? new Date(subscription.ended_at * 1000)
        : new Date();

      await this.prisma.subscription.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          status: 'CANCELED',
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : new Date(),
          endedAt: endDate,
        },
      });

      console.log(
        `✅ Subscription canceled for user: ${userSubscription.user.id}`,
      );

      return {
        success: true,
        userId: userSubscription.user.id,
        subscriptionId: subscription.id,
      };
    } catch (error) {
      console.error('❌ Error handling subscription canceled:', error);
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
          userId: user.id,
        },
        include: {
          plan: true,
        },
      });

      if (existingSubscription) {
        console.log(
          'Abonnement OPTION déjà existant:',
          existingSubscription.id,
        );
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

  async customerSubscriptionUpdated(event) {
    try {
      console.log('\n=== 🔄 WEBHOOK: SUBSCRIPTION UPDATED ===');
      console.log('Event ID:', event.id);
      console.log('Event type:', event.type);

      const subscription = event.data.object;
      console.log('Subscription ID:', subscription.id);
      console.log('Status:', subscription.status);

      // 1️⃣ Récupérer les informations de l'abonnement Stripe
      const customerId = subscription.customer as string;
      const subscriptionId = subscription.id;
      const status = subscription.status;
      const cancelAtPeriodEnd = subscription.cancel_at_period_end;
      const canceledAt = subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null;

      console.log('Customer ID:', customerId);
      console.log('Cancel at period end:', cancelAtPeriodEnd);

      // 2️⃣ Récupérer le customer Stripe pour avoir l'email
      const customer = await this.stripe.customers.retrieve(customerId);
      const email = (customer as Stripe.Customer).email;

      console.log('Customer email:', email);

      if (!email) {
        throw new Error('Email client non trouvé');
      }

      // 3️⃣ Trouver l'utilisateur dans la base de données
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        console.error(`❌ Utilisateur non trouvé pour l'email: ${email}`);
        throw new Error(`Utilisateur non trouvé: ${email}`);
      }

      console.log('User found:', user.id);

      // 4️⃣ Récupérer l'abonnement existant dans la DB
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { plan: true },
      });

      if (!existingSubscription) {
        console.error(`❌ Abonnement non trouvé: ${subscriptionId}`);
        throw new Error(
          `Abonnement non trouvé dans la base de données: ${subscriptionId}`,
        );
      }

      console.log('Existing subscription:', existingSubscription.id);
      console.log('Plan type:', existingSubscription.plan.planType);

      // 5️⃣ Extraire les items de l'abonnement
      const subscriptionItems = subscription.items.data;
      const firstItem = subscriptionItems[0];
      const quantity = subscription.quantity || 0;
      const priceId = firstItem.price.id;

      console.log('Subscription items count:', subscriptionItems.length);
      console.log('Quantity:', quantity);
      console.log('Price ID:', priceId);

      // 7️⃣ Déterminer si c'est un abonnement MAIN ou OPTION
      const isMainSubscription = existingSubscription.plan.planType === 'MAIN';
      const isOptionSubscription =
        existingSubscription.plan.planType === 'OPTION';

      console.log('Is main subscription:', isMainSubscription);
      console.log('Is option subscription:', isOptionSubscription);

      // 8️⃣ Mettre à jour l'abonnement dans la base de données
      const updatedSubscription = await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          quantity: quantity,
          cancelAtPeriodEnd,
          canceledAt,
          endedAt: status === 'canceled' ? new Date() : null,
          metadata: {
            lastUpdated: new Date().toISOString(),
            webhookEventId: event.id,
            stripeStatus: status,
          },
        },
        include: { plan: true },
      });

      console.log('✅ Subscription updated in database');

      // 9️⃣ Si c'est une option, mettre à jour le currentMaxScreens de l'abonnement principal
      if (isOptionSubscription) {
        console.log('\n📺 Mise à jour des écrans pour abonnement OPTION');

        // Récupérer l'abonnement principal
        const mainSubscription = await this.prisma.subscription.findFirst({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            plan: {
              planType: 'MAIN',
            },
          },
          include: { plan: true },
        });

        if (mainSubscription) {
          const baseScreens = mainSubscription.plan.maxScreens || 5;
          const additionalScreens = status === 'canceled' ? 0 : quantity;
          const newTotalScreens = additionalScreens;

          console.log(`   Base screens: ${baseScreens}`);
          console.log(`   Additional screens: ${additionalScreens}`);
          console.log(`   New total: ${newTotalScreens}`);

          // Mettre à jour le currentMaxScreens
          await this.prisma.subscription.update({
            where: { id: mainSubscription.id },
            data: {
              currentMaxScreens: baseScreens + newTotalScreens,
            },
          });

          console.log('✅ Main subscription screens updated');
        } else {
          console.warn(
            '⚠️ Abonnement principal non trouvé pour mettre à jour les écrans',
          );
        }
      }

      // 🔟 Si l'abonnement principal est annulé, mettre à jour toutes les options
      if (
        isMainSubscription &&
        (status === 'canceled' || status === 'unpaid')
      ) {
        console.log('\n🚫 Abonnement principal annulé - Gestion des options');

        // Annuler toutes les options actives
        const activeOptions = await this.prisma.subscription.findMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            plan: {
              planType: 'OPTION',
            },
          },
        });

        console.log(`   Options actives trouvées: ${activeOptions.length}`);

        for (const option of activeOptions) {
          try {
            // Annuler l'abonnement Stripe
            await this.stripe.subscriptions.cancel(option.stripeSubscriptionId);

            // Mettre à jour dans la DB
            await this.prisma.subscription.update({
              where: { id: option.id },
              data: {
                status: 'CANCELED',
                canceledAt: new Date(),
                endedAt: new Date(),
                cancelAtPeriodEnd: false,
              },
            });

            console.log(`   ✅ Option annulée: ${option.id}`);
          } catch (error) {
            console.error(
              `   ❌ Erreur annulation option ${option.id}:`,
              error.message,
            );
          }
        }
      }

      console.log('\n✅ WEBHOOK TRAITÉ AVEC SUCCÈS\n');

      return {
        success: true,
        message: 'Abonnement mis à jour avec succès',
        subscription: updatedSubscription,
      };
    } catch (error) {
      console.error('\n❌ ERREUR WEBHOOK SUBSCRIPTION UPDATED:', error);
      console.error('Stack:', error.stack);
      throw error;
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
    const baseMaxScreens = subscriptionPlan.maxScreens;
    // ❌ const totalMaxScreens = baseMaxScreens + quantity;
    // ✅ Pour un plan principal, la quantité multiplie les écrans de base
    const totalMaxScreens = baseMaxScreens;

    console.log('📊 Calcul plan principal:', {
      baseMaxScreens,
      quantity,
      totalMaxScreens,
      formula: `${baseMaxScreens} + ${quantity} = ${totalMaxScreens}`,
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
          canceledAt: new Date(),
          currentMaxScreens: totalMaxScreens,
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
        id: subscriptionId,
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
    try {
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
      console.log(
        '🚀 ~ StripeService ~ handleOptionSubscription ~ mainSubscription:',
        mainSubscription,
      );

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
      const totalAdditionalScreens =
        mainSubscription.currentMaxScreens + quantity;

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
    } catch (error) {
      console.log('ERREUR : ', error);
    }
  }

  // Fonction inchangée mais avec logs améliorés
  async updateMainSubscriptionLimits(mainSubscriptionId, userId) {
    console.log("🔄 Mise à jour des limites de l'abonnement principal...");

    const mainSubscription = await this.prisma.subscription.findUnique({
      where: {
        id: mainSubscriptionId,
        plan: {
          planType: 'MAIN',
        },
      },
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
    const mainPlanBaseScreens = mainSubscription.currentMaxScreens || 1;

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
  /*async createCheckoutSession(data: any) {
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
  }*/

  async createCheckoutSession(data: any) {
    const PRICE_ID_MAPPING: Record<string, string> = {
      price_1S7OvoAQxGgWdn2vEKo3nksD: 'price_1Tb5PqANLgUUwLkDfZLeNtBx', // ⚠️ remplacer par le price_... live du produit prod_T3VxhrYWMoBxlt
      price_1S7OuqAQxGgWdn2vTmQFwkQs: 'price_1Tb5PtANLgUUwLkDyUqm6kQ6',
      price_1S7dNCAQxGgWdn2vUVFHeO6S: 'price_1Tb5PlANLgUUwLkDjqsWfftU',
    };

    try {
      const resolvedPriceId = PRICE_ID_MAPPING[data.priceId] ?? data.priceId;

      const line_items = [
        {
          price: resolvedPriceId,
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
        payment_method_types: ['card', 'paypal'],
        line_items,
        mode: 'subscription',
        metadata: {
          firstName: data.data.firstName,
          lastName: data.data.lastName,
          company: data.data.company,
          email: data.data.email,
        },
        customer_email: data.data.email,
        success_url: process.env.STRIPE_SUCCESS_URL,
        cancel_url: process.env.STRIPE_CANCEL_URL,
      });

      return { id: session.id, url: session.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { status: 404, error };
    }
  }

  async updateCheckoutSession(data: {
    subscriptionId: string;
    quantity: number;
  }) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        data.subscriptionId,
      );
      const subscriptionItem = subscription.items.data[0];
      const subscriptionItemId = subscription.items.data[0].id;
      const currentQuantity = subscriptionItem.quantity;
      const newQuantity = Number(data.quantity);

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.id,
        {
          items: [
            {
              id: subscriptionItemId,
              quantity: newQuantity,
            },
          ],
          // Proration par défaut : le client paie/reçoit un crédit proportionnel
          proration_behavior: 'create_prorations',
        },
      );

      return updatedSubscription;
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      throw error;
    }
  }

  async cancelSubscription(data: { subscriptionId: string }) {
    console.log('🚀 ~ StripeService ~ cancelSubscription ~ data:', data);

    // Validation de la donnée
    if (!data || !data.subscriptionId) {
      throw new Error('subscriptionId est requis pour annuler un abonnement');
    }

    // Validation du format
    if (
      typeof data.subscriptionId !== 'string' ||
      data.subscriptionId.trim() === ''
    ) {
      throw new Error('stripeSubscriptionId doit être une chaîne non vide');
    }

    try {
      const user = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: data.subscriptionId },
      });

      if (user) {
        await this.prisma.subscription.updateMany({
          where: {
            userId: user.id,
          },
          data: {
            status: 'CANCELED',
          },
        });
      }

      const subscription = await this.stripe.subscriptions.cancel(
        data.subscriptionId,
      );

      if (!subscription) {
        throw new Error("Impossible d'annuler l'abonnement");
      }

      return subscription;
    } catch (error) {
      console.error('🚀 ~ Erreur cancelSubscription:', error);
      throw new Error(`Erreur lors de l'annulation: ${error.message}`);
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
