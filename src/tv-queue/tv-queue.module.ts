import { Module } from '@nestjs/common';
import { TvQueueService } from './tv-queue.service';
import { TvQueueController } from './tv-queue.controller';
import { WebsocketsModule } from 'src/websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
  controllers: [TvQueueController],
  providers: [TvQueueService],
})
export class TvQueueModule {}
