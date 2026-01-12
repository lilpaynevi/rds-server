import { Body, Controller, Get, Header, Post, Req } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('cgu')
  @Header('Content-Type', 'text/html')
  displayCGU(): string {
    return this.appService.displayCGU();
  }

  @Get('contact')
  getContactPage(@Req() req: any) {
    // Si l'utilisateur est connecté, passer ses infos
    const user = req.user || null;
    return this.appService.displayContactForm(user);
  }

  // Route pour l'envoi du formulaire
  @Post('api/contact')
  async submitContactForm(@Body() contactData: any) {
    return await this.appService.sendSupportEmail(contactData);
  }
}
