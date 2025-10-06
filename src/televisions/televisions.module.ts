import { Module } from '@nestjs/common';
import { TelevisionsService } from './televisions.service';
import { TelevisionsController } from './televisions.controller';
import { WebsocketsGateway } from 'src/websockets/websockets.gateway';
import { WebsocketsService } from 'src/websockets/websockets.service';

@Module({
  imports: [],
  controllers: [TelevisionsController],
  providers: [TelevisionsService, WebsocketsGateway, WebsocketsService],
})
export class TelevisionsModule {}
