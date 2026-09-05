// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateAuthDto } from './dto/create-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

/**
 * Appliqué au seul corps de l'inscription : l'application n'installe pas de
 * ValidationPipe global, et en poser un maintenant validerait d'un coup tous
 * les autres contrôleurs (dont les DTO sont incomplets).
 *
 * `forbidNonWhitelisted` rejette explicitement tout champ inconnu — un client
 * qui tenterait d'ajouter `roles` ou `isVerify` reçoit un 400.
 */
const registerValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.login(createAuthDto);
  }

  @Post('register')
  async register(
    @Body(registerValidationPipe) registerAuthDto: RegisterAuthDto,
  ) {
    return this.authService.register(registerAuthDto);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() { email }: { email: string },
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() { token, password }: { token: string; password: string },
  ): Promise<{ message: string }> {
    return this.authService.resetPassword({ token, password });
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  getProfile(@GetUser() user: any) {
    return this.authService.getProfile(user);
  }

  @Post('validate-reset-token')
  async validateResetToken(@Body('token') token: string) {
    return this.authService.validateResetToken(token);
  }
}
