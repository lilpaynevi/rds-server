import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() data: any, @GetUser() user: any) {
    return this.schedulesService.create(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') scheduleId: string,
    @Body() data: any,
    @GetUser() user: any,
  ) {
    return this.schedulesService.update(scheduleId, data, user);
  }
}
