import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class MailService {
  private front_url = process.env.FRONTEND_API;
  private supportEmail = process.env.MAIL_FROM_ADDRESS;

  private apiKey = process.env.BREVO_API_KEY;
  private fromName = process.env.MAIL_FROM_NAME;
  private fromEmail = process.env.MAIL_FROM_ADDRESS;

  private readonly logger = new Logger(MailService.name);
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(
    private mailerService: MailerService,
    private prisma: PrismaService,
  ) {}

  async sendPasswordResetEmail(email: string, token: string, name?: string) {
    const resetUrl = `${this.front_url}/home/profile/subscription/reset-password?token=${token}`;
    const userName = name || 'Utilisateur';

    const htmlContent = this.getResetPasswordEmailTemplate(
      userName,
      email,
      resetUrl,
    );

    try {
      await this.sendMail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        html: htmlContent,
      });

      console.log(`Email de réinitialisation envoyé à ${email}`);
      return true;
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      throw error;
    }
  }

  async sendPasswordChangedConfirmation(email: string, name?: string) {
    const userName = name || 'Utilisateur';

    const htmlContent = this.getPasswordChangedEmailTemplate(
      userName,
      email,
      this.supportEmail,
    );

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return 'non existant';
    }

    try {
      await this.sendMail({
        to: email,
        subject: 'Votre mot de passe a été modifié',
        html: htmlContent,
      });

      console.log(`Email de confirmation envoyé à ${email}`);
      return true;
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      throw error;
    }
  }

  /**
   * Envoie un email via l'API Brevo
   */
  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const response = await axios.post(
        this.brevoApiUrl,
        {
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: [
            {
              email: options.to,
            },
          ],
          subject: options.subject,
          htmlContent: options.html,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
        },
      );

      this.logger.log(
        `Email envoyé avec succès à ${options.to} - Message ID: ${response.data.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de l'email à ${options.to}:`,
        error.response?.data || error.message,
      );
      throw new Error(
        `Échec de l'envoi de l'email: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  private getResetPasswordEmailTemplate(
    name: string,
    email: string,
    resetUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation de mot de passe</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 0;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 40px 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 28px;
              }
              .content {
                  padding: 40px 30px;
              }
              .content h2 {
                  color: #333;
                  margin-top: 0;
              }
              .content p {
                  color: #666;
                  margin-bottom: 20px;
              }
              .button-container {
                  text-align: center;
                  margin: 30px 0;
              }
              .button {
                  display: inline-block;
                  padding: 15px 40px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
                  text-align: center;
              }
              .button:hover {
                  background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
              }
              .info-box {
                  background-color: #f8f9fa;
                  border-left: 4px solid #667eea;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .info-box strong {
                  display: block;
                  margin-bottom: 5px;
              }
              .info-box p {
                  margin: 5px 0 0 0;
                  font-size: 14px;
              }
              .warning {
                  background-color: #fff3cd;
                  border-left: 4px solid #ffc107;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .warning strong {
                  display: block;
                  margin-bottom: 5px;
              }
              .warning p {
                  margin: 5px 0 0 0;
                  font-size: 14px;
              }
              .footer {
                  background-color: #f8f9fa;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #666;
              }
              .footer a {
                  color: #667eea;
                  text-decoration: none;
              }
              .link-text {
                  color: #667eea;
                  word-break: break-all;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔐 Réinitialisation de mot de passe</h1>
              </div>
              
              <div class="content">
                  <h2>Bonjour ${name},</h2>
                  
                  <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte associé à l'adresse <strong>${email}</strong>.</p>
                  
                  <p>Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
                  
                  <div class="button-container">
                      <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                  </div>
                  
                  <div class="info-box">
                      <strong>⏰ Ce lien expire dans 1 heure</strong>
                      <p>Pour des raisons de sécurité, ce lien ne peut être utilisé qu'une seule fois.</p>
                  </div>
                  
                  <div class="warning">
                      <strong>⚠️ Vous n'avez pas demandé cette réinitialisation ?</strong>
                      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.</p>
                  </div>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #999;">
                      Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                      <a href="${resetUrl}" class="link-text">${resetUrl}</a>
                  </p>
              </div>
              
              <div class="footer">
                  <p>Cet email a été envoyé par RDS Connect</p>
                  <p>Si vous avez des questions, contactez-nous à <a href="mailto:rdsconnect.contact@gmail.com">rdsconnect.contact@gmail.com</a></p>
                  <p style="margin-top: 20px; color: #999;">© 2024 RDS Connect. Tous droits réservés.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangedEmailTemplate(
    name: string,
    email: string,
    supportEmail: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mot de passe modifié</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  padding: 0;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 40px 20px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0;
                  font-size: 28px;
              }
              .content {
                  padding: 40px 30px;
              }
              .success-icon {
                  text-align: center;
                  font-size: 60px;
                  margin: 20px 0;
              }
              .content h2 {
                  color: #333;
                  text-align: center;
              }
              .content p {
                  color: #666;
                  margin-bottom: 20px;
              }
              .info-box {
                  background-color: #d1fae5;
                  border-left: 4px solid #10b981;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .info-box strong {
                  display: block;
                  margin-bottom: 5px;
              }
              .info-box p {
                  margin: 5px 0 0 0;
                  font-size: 14px;
              }
              .warning {
                  background-color: #fee2e2;
                  border-left: 4px solid #ef4444;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .warning strong {
                  display: block;
                  margin-bottom: 5px;
              }
              .warning p {
                  margin: 5px 0 0 0;
                  font-size: 14px;
              }
              .warning a {
                  color: #ef4444;
                  text-decoration: none;
                  font-weight: bold;
              }
              .footer {
                  background-color: #f8f9fa;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #666;
              }
              .footer a {
                  color: #667eea;
                  text-decoration: none;
              }
              ul {
                  color: #666;
                  padding-left: 20px;
              }
              ul li {
                  margin-bottom: 8px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>✅ Mot de passe modifié avec succès</h1>
              </div>
              
              <div class="content">
                  <div class="success-icon">🎉</div>
                  
                  <h2>Félicitations ${name} !</h2>
                  
                  <p>Votre mot de passe a été modifié avec succès pour le compte <strong>${email}</strong>.</p>
                  
                  <div class="info-box">
                      <strong>✓ Votre compte est maintenant sécurisé</strong>
                      <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                  </div>
                  
                  <div class="warning">
                      <strong>🚨 Vous n'avez pas effectué cette modification ?</strong>
                      <p>
                          Si vous n'êtes pas à l'origine de ce changement, votre compte a peut-être été compromis. 
                          Contactez immédiatement notre support à <a href="mailto:${supportEmail}">${supportEmail}</a>
                      </p>
                  </div>
                  
                  <p style="margin-top: 30px;">
                      <strong>Conseils de sécurité :</strong>
                  </p>
                  <ul>
                      <li>Ne partagez jamais votre mot de passe</li>
                      <li>Utilisez un mot de passe unique pour chaque service</li>
                      <li>Activez l'authentification à deux facteurs si disponible</li>
                      <li>Changez régulièrement vos mots de passe</li>
                  </ul>
              </div>
              
              <div class="footer">
                  <p>Cet email a été envoyé par RDS Connect</p>
                  <p>Besoin d'aide ? Contactez-nous à <a href="mailto:${supportEmail}">${supportEmail}</a></p>
                  <p style="margin-top: 20px; color: #999;">© 2024 RDS Connect. Tous droits réservés.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}
