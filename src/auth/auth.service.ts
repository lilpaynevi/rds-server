// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto } from './dto/create-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';
import { jwtDecode } from 'jwt-decode';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private prisma: PrismaService,
  ) {}

  async validateUser(createAuthDto: CreateAuthDto): Promise<User | null> {
    const user = await this.repository.findByUsername(createAuthDto.email);

    if (user && (await bcrypt.compare(createAuthDto.password, user.password))) {
      return user;
    }
    return null;
  }

  async login(createAuthDto: CreateAuthDto): Promise<object> {
    const user = await this.validateUser(createAuthDto);

    if (!user) {
      throw new UnauthorizedException(
        'Identifiant ou mot de passe incorrect',
      );
    }

    // Un administrateur n'est pas soumis à la validation : sans cette
    // exception, le tout premier compte ADMIN ne pourrait jamais se connecter
    // pour valider qui que ce soit.
    if (user.role !== 'ADMIN' && !user.isVerify) {
      throw new ForbiddenException(
        "Votre compte est en attente de validation par un administrateur. Vous recevrez un e-mail dès qu'il sera activé.",
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Votre compte a été désactivé. Contactez le support pour le réactiver.',
      );
    }

    // Le corps du JWT est lisible par quiconque détient le jeton : le hash
    // bcrypt et le jeton de réinitialisation n'y ont rien à faire.
    const { password, resetPasswordToken, resetPasswordExpires, ...safeUser } =
      user;

    const payload = { email: user.email, sub: user.id, user: safeUser };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Inscription d'un compte professionnel.
   *
   * Le compte est créé désactivé (`isVerify: false`) : il faut qu'un
   * administrateur le valide via PATCH /users/:userId/verified pour que la
   * connexion devienne possible.
   */
  async register(dto: RegisterAuthDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingEmail) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail');
    }

    const existingSiret = await this.prisma.user.findUnique({
      where: { siret: dto.siret },
      select: { id: true },
    });

    if (existingSiret) {
      throw new ConflictException(
        'Un compte existe déjà pour ce SIRET. Contactez le support si vous pensez qu\'il s\'agit d\'une erreur.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user: {
      id: string;
      firstName: string;
      lastName: string;
      company: string | null;
      siret: string | null;
      email: string;
      phone: string | null;
      isVerify: boolean;
      createdAt: Date;
    };

    try {
      // Champs énumérés un par un, volontairement : l'ancien handler passait le
      // corps de la requête tel quel à Prisma, ce qui laissait un client fixer
      // `roles: "ADMIN"` ou `isVerify: true` à l'inscription.
      user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          company: dto.company,
          siret: dto.siret,
          email: dto.email,
          phone: dto.phone ?? null,
          password: hashedPassword,
          // `role` fait foi ; `roles` est l'ancienne colonne synonyme, écrite
          // en parallèle pour que les deux ne divergent pas tant qu'elle existe.
          role: 'USER',
          roles: 'USER',
          isVerify: false,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          siret: true,
          email: true,
          phone: true,
          isVerify: true,
          createdAt: true,
        },
      });
    } catch (error) {
      // Deux inscriptions simultanées avec le même e-mail/SIRET passent les
      // vérifications ci-dessus et se heurtent à la contrainte unique.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[] | undefined)?.join(', ');
        throw new ConflictException(
          target?.includes('siret')
            ? 'Un compte existe déjà pour ce SIRET'
            : 'Un compte existe déjà avec cet e-mail',
        );
      }
      throw error;
    }

    // L'inscription est déjà enregistrée : une indisponibilité de Brevo ne doit
    // pas la faire échouer côté client. L'échec est journalisé pour que la
    // demande puisse être rattrapée depuis la liste des comptes en attente.
    try {
      await this.mailService.sendNewAccountPendingApproval(user);
    } catch (error) {
      this.logger.error(
        `Notification administrateurs impossible pour l'inscription de ${user.email}`,
        error?.stack ?? error,
      );
    }

    return {
      message:
        "Votre compte a bien été créé. Il doit maintenant être validé par un administrateur : vous recevrez un e-mail dès qu'il sera activé.",
      pendingApproval: true,
      user,
    };
  }

  /**
   * Génère un token de réinitialisation de mot de passe et l'envoie par email
   */
  async forgotPassword(
    forgotPasswordDto: any,
  ): Promise<{ message: string }> {
    console.log("🚀 ~ AuthService ~ forgotPassword ~ forgotPasswordDto:", forgotPasswordDto)
    const email = forgotPasswordDto;

    // Chercher l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Pour des raisons de sécurité, on retourne toujours le même message
    // même si l'utilisateur n'existe pas (éviter l'énumération d'emails)
    const successMessage = {
      message:
        'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
    };

    if (!user) {
      // Attendre un peu pour éviter le timing attack
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return successMessage;
    }

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hasher le token avant de le sauvegarder
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Définir l'expiration (1 heure)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Sauvegarder le token hashé et sa date d'expiration
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await this.prisma.user.updateMany({
      data: user,
      where: {
        id: user.id,
      },
    });

    // Créer un JWT pour le reset (plus sécurisé qu'un simple token)
    const jwtToken = this.jwtService.sign(
      {
        userId: user.id,
        email: user.email,
        resetToken: resetToken, // Token non hashé dans le JWT
        type: 'password-reset',
      },
      {
        expiresIn: '1h',
      },
    );

    // Envoyer l'email avec le JWT
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        jwtToken,
        user?.firstName + ' ' + user.lastName || 'User',
      );
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      // On ne révèle pas l'erreur au client
    }

    return successMessage;
  }

  /**
   * Réinitialise le mot de passe avec le token fourni
   */
  async resetPassword(
    resetPasswordDto: any,
  ): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;
    console.log("🚀 ~ AuthService ~ resetPassword ~ resetPasswordDto:", resetPasswordDto)

    // Vérifier et décoder le JWT
    let decoded;
    try {
      decoded = this.jwtService.verify(token);
    } catch (error) {
      throw new BadRequestException(
        'Le lien de réinitialisation est invalide ou a expiré',
      );
    }

    // Vérifier que c'est bien un token de reset
    if (decoded.type !== 'password-reset') {
      throw new BadRequestException('Token invalide');
    }

    // Chercher l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Le lien de réinitialisation est invalide ou a expiré',
      );
    }

    // Vérifier que le token correspond
    const isTokenValid = await bcrypt.compare(
      decoded.resetToken,
      user.resetPasswordToken,
    );

    if (!isTokenValid) {
      throw new BadRequestException(
        'Le lien de réinitialisation est invalide ou a expiré',
      );
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe et supprimer le token
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.prisma.user.updateMany({
      where: {
        id: user.id
      },
      data: user
    });

    // Envoyer un email de confirmation
    try {
      await this.mailService.sendPasswordChangedConfirmation(
        user.email,
        user.firstName + ' ' + user.lastName,
      );
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de l'email de confirmation:",
        error,
      );
    }

    return {
      message: 'Votre mot de passe a été réinitialisé avec succès',
    };
  }

  /**
   * Vérifie la validité d'un token de reset
   */
  //! ATTENTION AU MoteThan dans la fonction ===> MoreThan(new Date())
  async validateResetToken(
    token: string,
  ): Promise<{ valid: boolean; email?: string }> {
    console.log("🚀 ~ AuthService ~ validateResetToken ~ token:", token)
    try {
      const decoded = this.jwtService.verify(token);
      console.log("🚀 ~ AuthService ~ validateResetToken ~ decoded:", decoded)

      if (decoded.type !== 'password-reset') {
        return { valid: false };
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: decoded.userId,
        },
      });

      if (!user) {
        return { valid: false };
      }

      const isTokenValid = await bcrypt.compare(
        decoded.resetToken,
        user.resetPasswordToken,
      );

      if (!isTokenValid) {
        return { valid: false };
      }

      return {
        valid: true,
        email: user.email,
      };
    } catch (error) {
      return { valid: false };
    }
  }

  async getProfile(req: any): Promise<any> {
    const user = await this.repository.findOne(req.sub);
    if (user) {
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        siret: user.siret,
        isActive: user.isActive,
        isVerify: user.isVerify,
        role: user.role,
        ...req,
        subscription: user.Subscription,
      };
    }
    return req;
  }
}
