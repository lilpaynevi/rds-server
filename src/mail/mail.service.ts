import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class MailService {
  private front_url = process.env.FRONTEND_API;
  private dashboard_url =
    process.env.DASHBOARD || 'https://dashboard.rdsconnect.site/';
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
   * Prévient les administrateurs qu'un compte professionnel vient d'être créé
   * et attend leur validation.
   *
   * Les destinataires sont les comptes `role = ADMIN` en base : ajouter un
   * administrateur ne demande donc pas de redéploiement. S'il n'en existe
   * aucun, on journalise un avertissement plutôt que de lever — l'inscription
   * ne doit pas échouer à cause de la configuration des notifications.
   */
  async sendNewAccountPendingApproval(user: {
    firstName: string;
    lastName: string;
    company: string | null;
    siret: string | null;
    email: string;
    phone?: string | null;
    createdAt: Date;
  }): Promise<boolean> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });

    const recipients = admins.map((admin) => admin.email);

    if (recipients.length === 0) {
      this.logger.warn(
        `Aucun compte ADMIN en base : la demande de validation de ${user.email} n'a été notifiée à personne.`,
      );
      return false;
    }

    await this.sendMail({
      to: recipients,
      subject: `Nouvelle demande de compte — ${user.company ?? `${user.firstName} ${user.lastName}`}`,
      html: this.getNewAccountPendingTemplate(user),
    });

    this.logger.log(
      `Demande de validation pour ${user.email} notifiée à ${recipients.length} administrateur(s)`,
    );
    return true;
  }

  /**
   * Prévient l'utilisateur que son compte vient d'être validé et qu'il peut
   * désormais se connecter.
   */
  async sendAccountApprovedEmail(email: string, name?: string) {
    await this.sendMail({
      to: email,
      subject: 'Votre compte RDS Connect a été validé',
      html: this.getAccountApprovedTemplate(name || 'Utilisateur'),
    });

    this.logger.log(`Email de validation de compte envoyé à ${email}`);
    return true;
  }

  /**
   * Envoie un email via l'API Brevo
   */
  async sendMail(options: {
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const response = await axios.post(
        this.brevoApiUrl,
        {
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: recipients.map((email) => ({ email })),
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
        `Email envoyé avec succès à ${recipients.join(', ')} - Message ID: ${response.data.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de l'email à ${recipients.join(', ')}:`,
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

  /**
   * Les valeurs viennent d'un formulaire public : elles sont échappées avant
   * d'être interpolées dans le HTML de l'email.
   */
  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Affiche « 123 456 789 00012 » plutôt que 14 chiffres collés. */
  private formatSiret(siret: string | null): string {
    if (!siret || siret.length !== 14) return siret ?? '—';
    return `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9)}`;
  }

  private getNewAccountPendingTemplate(user: {
    firstName: string;
    lastName: string;
    company: string | null;
    siret: string | null;
    email: string;
    phone?: string | null;
    createdAt: Date;
  }): string {
    const name = this.escapeHtml(`${user.firstName} ${user.lastName}`);
    const company = this.escapeHtml(user.company ?? '—');
    const siret = this.escapeHtml(this.formatSiret(user.siret));
    const email = this.escapeHtml(user.email);
    const phone = this.escapeHtml(user.phone ?? '—');
    const createdAt = new Date(user.createdAt).toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    });

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nouvelle demande de compte</title>
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
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #4F8EF7 0%, #7C4DFF 100%);
                  color: white;
                  padding: 40px 20px;
                  text-align: center;
              }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 40px 30px; }
              .content h2 { color: #333; margin-top: 0; }
              .content p { color: #666; margin-bottom: 20px; }
              table.details {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;
              }
              table.details th {
                  text-align: left;
                  padding: 12px 10px;
                  color: #888;
                  font-size: 13px;
                  text-transform: uppercase;
                  letter-spacing: 0.4px;
                  width: 40%;
                  border-bottom: 1px solid #eee;
                  vertical-align: top;
              }
              table.details td {
                  padding: 12px 10px;
                  color: #222;
                  font-weight: 600;
                  border-bottom: 1px solid #eee;
                  word-break: break-word;
              }
              .button-container { text-align: center; margin: 30px 0; }
              .button {
                  display: inline-block;
                  padding: 15px 40px;
                  background: linear-gradient(135deg, #4F8EF7 0%, #7C4DFF 100%);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
              }
              .info-box {
                  background-color: #f8f9fa;
                  border-left: 4px solid #4F8EF7;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
                  font-size: 14px;
              }
              .footer {
                  background-color: #f8f9fa;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #666;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔔 Nouvelle demande de compte</h1>
              </div>

              <div class="content">
                  <h2>Un professionnel attend votre validation</h2>

                  <p>Une demande de création de compte vient d'être déposée sur RDS Connect. Le compte reste inaccessible tant qu'un administrateur ne l'a pas validé.</p>

                  <table class="details">
                      <tr><th>Entreprise</th><td>${company}</td></tr>
                      <tr><th>SIRET</th><td>${siret}</td></tr>
                      <tr><th>Contact</th><td>${name}</td></tr>
                      <tr><th>E-mail</th><td>${email}</td></tr>
                      <tr><th>Téléphone</th><td>${phone}</td></tr>
                      <tr><th>Demande reçue le</th><td>${createdAt}</td></tr>
                  </table>

                  <div class="button-container">
                      <a href="${this.dashboard_url}" class="button">Ouvrir RDS Connect</a>
                  </div>

                  <div class="info-box">
                      Vérifiez le SIRET sur <a href="https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(user.siret ?? '')}">l'Annuaire des Entreprises</a> avant de valider la demande.
                  </div>
              </div>

              <div class="footer">
                  <p>Notification automatique envoyée aux administrateurs RDS Connect</p>
                  <p style="margin-top: 20px; color: #999;">© 2024 RDS Connect. Tous droits réservés.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private getAccountApprovedTemplate(name: string): string {
    const safeName = this.escapeHtml(name);

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Votre compte a été validé</title>
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
              .header h1 { margin: 0; font-size: 26px; }
              .content { padding: 40px 30px; }
              .success-icon { text-align: center; font-size: 60px; margin: 10px 0 20px; }
              .content h2 { color: #333; text-align: center; margin-top: 0; }
              .content p { color: #666; margin-bottom: 20px; }
              .button-container { text-align: center; margin: 30px 0; }
              .button {
                  display: inline-block;
                  padding: 15px 40px;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
              }
              .info-box {
                  background-color: #d1fae5;
                  border-left: 4px solid #10b981;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 4px;
              }
              .info-box strong { display: block; margin-bottom: 5px; }
              .info-box p { margin: 5px 0 0 0; font-size: 14px; }
              ul { color: #666; padding-left: 20px; }
              ul li { margin-bottom: 8px; }
              .footer {
                  background-color: #f8f9fa;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #666;
              }
              .footer a { color: #667eea; text-decoration: none; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>✅ Votre compte a été validé</h1>
              </div>

              <div class="content">
                  <div class="success-icon">🎉</div>

                  <h2>Bienvenue ${safeName} !</h2>

                  <p>Bonne nouvelle : votre compte professionnel RDS Connect vient d'être validé par notre équipe. Vous pouvez dès maintenant vous connecter avec l'e-mail et le mot de passe choisis lors de votre inscription.</p>

                  <div class="button-container">
                      <a href="${this.front_url}" class="button">Me connecter</a>
                  </div>

                  <div class="info-box">
                      <strong>✓ Vos premiers pas</strong>
                      <p>Appairez votre premier écran, créez une playlist, puis programmez sa diffusion.</p>
                  </div>

                  <p><strong>Pour bien démarrer :</strong></p>
                  <ul>
                      <li>Connectez-vous et complétez votre profil</li>
                      <li>Ajoutez un écran depuis l'onglet dédié</li>
                      <li>Importez vos médias et composez une playlist</li>
                  </ul>
              </div>

              <div class="footer">
                  <p>Cet email a été envoyé par RDS Connect</p>
                  <p>Besoin d'aide ? Contactez-nous à <a href="mailto:${this.supportEmail}">${this.supportEmail}</a></p>
                  <p style="margin-top: 20px; color: #999;">© 2024 RDS Connect. Tous droits réservés.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}
