import { Module } from '@nestjs/common';
import { TelevisionsService } from './televisions.service';
import { TelevisionsController } from './televisions.controller';
import { WebsocketsModule } from 'src/websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
  controllers: [TelevisionsController],
  providers: [TelevisionsService],
})
export class TelevisionsModule {}
