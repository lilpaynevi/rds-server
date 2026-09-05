import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs/promises';
import Stripe from 'stripe';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  private readonly stripe: Stripe;
  private uploadsPath: string;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SK_KEY);
    this.uploadsPath = path.join(process.cwd(), 'uploads');
  }

  async create(createUserDto: User) {
    const existingUser = await this.findByUsername(createUserDto.email);
    if (existingUser) {
      throw new BadRequestException('email existe deja ');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = {
      ...createUserDto,
      password: hashedPassword,
    };

    return this.prisma.user.create({
      data: newUser,
    });
  }

  register(createUserDto: any) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findByUsername(email: User['email']): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByEmail(email: User['email']): Promise<User | null> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: {
        email,
      },
    });

    if (!user) {
      console.log(`Aucun compte trouvé avec l'adresse e-mail ${email}`);
      return null;
    }

    return user;
  }

  async findAll() {
    // Aucun filtre sur le rôle : la liste doit montrer tous les comptes,
    // administrateurs inclus.
    //
    // Le `where: { roles: 'USER' }` d'origine était un filtre inopérant :
    // `roles` valait `USER` par défaut sur tous les comptes, y compris ceux
    // promus ADMIN via `role`. Le transposer en `role: 'USER'` l'a rendu
    // effectif et a fait disparaître les administrateurs de la liste.
    const users = await this.prisma.user.findMany({
      include: {
        televisions: {
          include: {
            playlists: true,
          },
        },
        playlists: {
          include: {
            items: {
              include: {
                media: {
                  include: {
                    _count: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            medias: true,
            televisions: true,
            playlists: true,
          },
        },
      },
    });

    // Cette réponse contient les télévisions de tous les comptes, donc leurs
    // `codeConnection` : GET /users est désormais derrière JwtAuthGuard
    // (users.controller.ts). Le hash bcrypt et le jeton de réinitialisation sont
    // retirés ici plutôt que par un `select`, pour ne rien changer à la forme
    // attendue par le dashboard (relations imbriquées incluses).
    return users.map(
      ({ password, resetPasswordToken, resetPasswordExpires, ...safe }) => safe,
    );
  }

  async findAllNotVerified() {
    const users = await this.prisma.user.findMany({
      where: {
        AND: {
          isVerify: false,
          isActive: true,
        },
      },
    });

    // Même traitement que `findAll` : la page d'approbation n'affiche que
    // l'identité et l'organisation du demandeur, elle n'a aucun besoin du hash
    // du mot de passe ni du jeton de réinitialisation.
    return users.map(
      ({ password, resetPasswordToken, resetPasswordExpires, ...safe }) => safe,
    );
  }

  /**
   * Validation (ou invalidation) d'un compte par un administrateur.
   *
   * L'e-mail d'activation n'est envoyé que sur la transition false -> true :
   * revalider un compte déjà actif ne doit pas renvoyer une seconde annonce à
   * l'utilisateur.
   */
  async VerifiedUser(userId: User['id'], isVerify: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerify: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const wasVerified = user.isVerify;

    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerify },
    });

    let emailSent = false;

    if (isVerify && !wasVerified) {
      // La validation est déjà enregistrée : un échec Brevo ne doit pas
      // renvoyer une erreur à l'administrateur ni annuler l'approbation.
      try {
        await this.mailService.sendAccountApprovedEmail(
          user.email,
          `${user.firstName} ${user.lastName}`.trim(),
        );
        emailSent = true;
      } catch (error) {
        this.logger.error(
          `Compte ${user.email} validé mais e-mail de confirmation non envoyé`,
          error?.stack ?? error,
        );
      }
    }

    return {
      success: true,
      id: user.id,
      isVerify,
      emailSent,
    };
  }

  async findOne(id: User['id']) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        televisions: true,
        playlists: true,
        Subscription: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            plan: true,
          },
        },
      },
    });

    // Compte inexistant : la déstructuration de `null` levait un TypeError
    // (500 sans message). 404 explicite, comme `remove()` juste en dessous.
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // `resetPasswordToken` était renvoyé tel quel : combiné à l'absence de
    // contrôle d'appartenance sur GET /users/:id, il permettait de récupérer le
    // jeton de réinitialisation d'un tiers et de prendre son compte. Même
    // filtrage que `findAll` / `findAllNotVerified` (aucun de ces champs n'est
    // lu par le dashboard).
    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      ...userWithoutPassword
    } = user;
    return userWithoutPassword;
  }

  update(id: User['id'], updateUserDto: any) {
    return this.prisma.user.updateMany({
      data: updateUserDto,
      where: {
        id,
      },
    });
  }

  /**
   * Suppression complète du compte utilisateur
   * - Annule tous les abonnements Stripe
   * - Supprime tous les médias locaux
   * - Supprime toutes les données en cascade
   */
  async remove(userId: User['id']) {
    // 1. Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        Subscription: true,
        medias: true,
        televisions: true,
        playlists: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    console.log(`🗑️  Début de la suppression du compte: ${user.email}`);

    try {
      // 2. Annuler tous les abonnements Stripe actifs
      if (user.Subscription && user.Subscription.length > 0) {
        await this.cancelAllSubscriptions(user.Subscription);
      }

      // 3. Supprimer tous les fichiers médias locaux
      if (user.medias && user.medias.length > 0) {
        await this.deleteAllUserMediaFiles(user.medias);
      }

      // 4. Supprimer l'avatar si présent
      // if (user.avatar) {
      //   await this.deleteFile(user.avatar);
      // }

      // 5. Supprimer toutes les données en BDD (cascade automatique via Prisma)
      await this.prisma.$transaction(async (tx) => {
        // Supprimer les logs de télévisions
        await tx.televisionLog.deleteMany({
          where: {
            television: {
              userId: userId,
            },
          },
        });

        // Supprimer les schedules
        await tx.schedule.deleteMany({
          where: { userId },
        });

        // Supprimer les playlist-television links
        await tx.playlistTelevision.deleteMany({
          where: {
            television: {
              userId: userId,
            },
          },
        });

        // Supprimer les playlist items
        await tx.playlistItem.deleteMany({
          where: {
            playlist: {
              userId: userId,
            },
          },
        });

        // Supprimer les playlists
        await tx.playlist.deleteMany({
          where: { userId },
        });

        // Supprimer les médias (BDD uniquement, fichiers déjà supprimés)
        await tx.media.deleteMany({
          where: { userId },
        });

        // Supprimer les télévisions
        await tx.television.deleteMany({
          where: { userId },
        });

        // Supprimer les invoices
        await tx.invoice.deleteMany({
          where: { userId },
        });

        // Supprimer les subscriptions
        await tx.subscription.deleteMany({
          where: { userId },
        });

        // Enfin, supprimer l'utilisateur
        await tx.user.delete({
          where: { id: userId },
        });
      });

      console.log(`✅ Compte supprimé avec succès: ${user.email}`);

      return {
        success: true,
        message: 'Compte supprimé définitivement',
        deletedUser: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error) {
      console.error('❌ Erreur lors de la suppression du compte:', error);
      throw new BadRequestException(
        'Erreur lors de la suppression du compte: ' + error.message,
      );
    }
  }

  /**
   * Annule tous les abonnements Stripe de l'utilisateur
   */
  private async cancelAllSubscriptions(subscriptions: any[]) {
    console.log(
      `📋 Annulation de ${subscriptions.length} abonnement(s) Stripe...`,
    );

    const cancelPromises = subscriptions.map(async (subscription) => {
      if (
        subscription.stripeSubscriptionId &&
        subscription.status === 'ACTIVE'
      ) {
        try {
          // Annuler immédiatement l'abonnement
          const canceled = await this.stripe.subscriptions.cancel(
            subscription.stripeSubscriptionId,
            {
              prorate: false, // Pas de prorata
            },
          );

          console.log(`✅ Abonnement Stripe annulé: ${canceled.id}`);
          return canceled;
        } catch (error) {
          console.error(
            `⚠️  Erreur annulation Stripe ${subscription.stripeSubscriptionId}:`,
            error.message,
          );
          // Continue même si une annulation échoue
        }
      }
    });

    await Promise.allSettled(cancelPromises);
    console.log(`✅ Tous les abonnements traités`);
  }

  /**
   * Supprime tous les fichiers médias locaux de l'utilisateur
   */
  private async deleteAllUserMediaFiles(medias: any[]) {
    console.log(`📁 Suppression de ${medias.length} fichier(s) média(s)...`);

    let deletedCount = 0;
    let errorCount = 0;

    const deletePromises = medias.map(async (media) => {
      try {
        // Supprimer le fichier principal
        if (media.url) {
          await this.deleteFile(media.url);
          deletedCount++;
        }

        // Supprimer la thumbnail si elle existe
        if (media.thumbnail) {
          await this.deleteFile(media.thumbnail);
        }
      } catch (error) {
        console.error(
          `⚠️  Erreur suppression fichier ${media.title}:`,
          error.message,
        );
        errorCount++;
      }
    });

    await Promise.allSettled(deletePromises);

    console.log(
      `✅ Fichiers supprimés: ${deletedCount}, Erreurs: ${errorCount}`,
    );
  }

  /**
   * Supprime un fichier local
   */
  private async deleteFile(filePathOrUrl: string): Promise<void> {
    try {
      let filePath: string;

      // Si c'est une URL complète (http://localhost:3000/uploads/...)
      if (filePathOrUrl.startsWith('http')) {
        const url = new URL(filePathOrUrl);
        filePath = path.join(process.cwd(), url.pathname);
      }
      // Si c'est un chemin relatif (/uploads/...)
      else if (filePathOrUrl.startsWith('/uploads')) {
        filePath = path.join(process.cwd(), filePathOrUrl);
      }
      // Si c'est juste le nom du fichier
      else {
        filePath = path.join(this.uploadsPath, filePathOrUrl);
      }

      // Vérifier si le fichier existe avant de le supprimer
      await fs.access(filePath);
      await fs.unlink(filePath);

      console.log(`🗑️  Fichier supprimé: ${filePath}`);
    } catch (error) {
      // Si le fichier n'existe pas, on ignore l'erreur
      if (error.code === 'ENOENT') {
        console.log(
          `⚠️  Fichier inexistant (déjà supprimé?): ${filePathOrUrl}`,
        );
      } else {
        console.error(
          `❌ Erreur suppression fichier ${filePathOrUrl}:`,
          error.message,
        );
        throw error;
      }
    }
  }

  /**
   * Optionnel: Supprimer tout le dossier uploads d'un utilisateur
   */
  private async deleteUserFolder(userId: string): Promise<void> {
    const userFolder = path.join(this.uploadsPath, userId);

    try {
      await fs.access(userFolder);
      await fs.rm(userFolder, { recursive: true, force: true });
      console.log(`📂 Dossier utilisateur supprimé: ${userFolder}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`⚠️  Erreur suppression dossier:`, error.message);
      }
    }
  }
}
