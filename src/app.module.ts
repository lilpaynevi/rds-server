import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TelevisionsModule } from './televisions/televisions.module';
import { WebsocketsModule } from './websockets/websockets.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { UploadsModule } from './uploads/uploads.module';
import { StripeModule } from './stripe/stripe.module';
import { ConfigModule } from '@nestjs/config';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [UsersModule, 
    PrismaModule, AuthModule, TelevisionsModule, WebsocketsModule, PlaylistsModule, UploadsModule, StripeModule,
    ConfigModule.forRoot({
      isGlobal: true, // Rend ConfigService disponible partout
      envFilePath: '.env', // Chemin vers le fichier .env
      cache: true, // Met en cache les variables pour de meilleures performances
    }),
    SchedulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
