// src/televisions/televisions.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TelevisionsService } from './televisions.service';
import { CreateTelevisionDto } from './dto/create-television.dto';
import { UpdateTelevisionDto } from './dto/update-television.dto';
import { QueryTelevisionDto } from './dto/query-television.dto';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('televisions')
export class TelevisionsController {
  constructor(private readonly televisionsService: TelevisionsService) {}

  // @Post()
  // create(@Body() createTelevisionDto: CreateTelevisionDto) {
  //   return this.televisionsService.create(createTelevisionDto);
  // }

  @Get()
  findAll(@Query() query: QueryTelevisionDto) {
    // return this.televisionsService.findAll(query);
    return this.televisionsService.findAll();
  }

  @Get('/dashboard')
  findAllDashboard(@Query() query: QueryTelevisionDto) {
    // return this.televisionsService.findAll(query);
    return this.televisionsService.findAllDashboard();
  }
  @Post('/check')
  checkCode(@Body() data: any) {
    return this.televisionsService.checkCodeOrCreate(data);
  }
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  MyTVs(@GetUser() user: any) {
    return this.televisionsService.MyTVs(user);
  }
  @Get('statistics')
  getStatistics() {
    return this.televisionsService.getStatistics();
  }

  // @Get('device/:deviceId')
  // findByDeviceId(@Param('deviceId') deviceId: string) {
  //   return this.televisionsService.findByDeviceId(deviceId);
  // }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeUser') includeUser?: string,
    @Query('includePlaylists') includePlaylists?: string,
  ) {
    return this.televisionsService.findOne(
      id,
      includeUser === 'true',
      includePlaylists === 'true',
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTelevisionDto: UpdateTelevisionDto,
  ) {
    return this.televisionsService.update(id, updateTelevisionDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.televisionsService.updateStatus(id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.televisionsService.remove(id);
  }
}
