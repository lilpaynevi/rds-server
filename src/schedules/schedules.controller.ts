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
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@GetUser() user: any) {
    return this.schedulesService.findAll(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tv/:tvId')
  async findByTv(@Param('tvId') tvId: string) {
    return this.schedulesService.findByTv(tvId);
  }

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

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') scheduleId: string, @GetUser() user: any) {
    return this.schedulesService.delete(scheduleId, user);
  }
}
