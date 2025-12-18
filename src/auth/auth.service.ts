// src/auth/auth.service.ts
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto } from './dto/create-auth.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';
import { jwtDecode } from 'jwt-decode';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private prisma: PrismaService,
  ) {}

  async validateUser(createAuthDto: CreateAuthDto): Promise<User | null> {
    const user = await this.repository.findByUsername(createAuthDto.email);
    console.log('🚀 ~ AuthService ~ validateUser ~ user:', user);

    if (user && (await bcrypt.compare(createAuthDto.password, user.password))) {
      return user;
    }
    return null;
  }

  async login(createAuthDto: CreateAuthDto): Promise<object> {
    console.log('🚀 ~ AuthService ~ login ~ createAuthDto:', createAuthDto);
    const user = await this.validateUser(createAuthDto);
    console.log('🚀 ~ AuthService ~ login ~ user:', user);
    if (!user) {
      throw new UnauthorizedException();
    }
    const payload = { email: user.email, sub: user.id, user };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(data: User) {
    return this.repository.create(data);
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
        isActive: user.isActive,
        ...req,
        subscription: user.Subscription,
      };
    }
    return req;
  }
}
