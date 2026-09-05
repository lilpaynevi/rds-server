import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './auth.strategy';
import { UsersModule } from 'src/users/users.module';
import { MailModule } from 'src/mail/mail.module';
dotenv.config();

@Module({
  imports:[UsersModule,
    ConfigModule.forRoot(),
    PassportModule,
    MailModule,
    
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      // signOptions: { expiresIn: '1h' }, // Optionnel : définis la durée de validité des tokens
    })
  ],
  controllers: [AuthController],
  // UsersService n'est plus redéclaré ici : UsersModule l'exporte désormais.
  // Le redéclarer créait une seconde instance, à réinjecter à chaque nouvelle
  // dépendance du service (MailService aujourd'hui).
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
