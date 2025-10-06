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

import { jwtDecode } from 'jwt-decode';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: UsersService,
    private jwtService: JwtService,
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

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`No user found for email: ${email}`);
    }

    await this.sendResetPasswordLink(email);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const email = await this.decodeConfirmationToken(token);

    const user = this.repository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`No user found for email: ${email}`);
    }

    // user.password = password;
    // delete user.resetToken; // remove the token after the password is updated
  }

  public async decodeConfirmationToken(token: string) {
    try {
      const payload = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      if (typeof payload === 'object' && 'email' in payload) {
        return payload.email;
      }

      throw new BadRequestException();
    } catch (error) {
      if (error?.name === 'TokenExpiredError') {
        throw new BadRequestException('Email confirmation token expired');
      }
      throw new BadRequestException('Bad confirmation token');
    }
  }

  public async sendResetPasswordLink(email: string): Promise<void> {
    const payload = { email };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '3600s',
    });

    const user = await this.repository.findByEmail(email);
    // user.resetToken = token;

    const url = `${process.env.EMAIL_RESET_PASSWORD_URL}/auth/reset-password?token=${token}`;

    const text = `${url}`;
  }

  async getProfile(req: any): Promise<any> {
    const user = await this.repository.findOne(req.sub);
    if (user) {
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        ...req,
        subscription: user.Subscription,
      };
    }
    return req;
  }
}
