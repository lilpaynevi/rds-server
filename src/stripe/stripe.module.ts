import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports:[
      ConfigModule.forRoot(),
      PassportModule,
      
    ],
  controllers: [StripeController],
  providers: [StripeService],
})
export class StripeModule {}
