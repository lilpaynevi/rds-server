import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TvQueueService } from './tv-queue.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('tv-queue')
export class TvQueueController {
  constructor(private readonly tvQueueService: TvQueueService) {}

  @UseGuards(JwtAuthGuard)
  @Get('tv/:televisionId')
  async findByTv(@Param('televisionId') televisionId: string, @GetUser() user: any) {
    return this.tvQueueService.findByTv(televisionId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() data: { televisionId: string; playlistId: string },
    @GetUser() user: any,
  ) {
    return this.tvQueueService.addToQueue(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  async reorder(
    @Body() data: { televisionId: string; items: { id: string; position: number }[] },
    @GetUser() user: any,
  ) {
    return this.tvQueueService.reorder(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: any) {
    return this.tvQueueService.remove(id, user);
  }
}
