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
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { GetUser } from 'src/decorator/get-user.decorator';

@Controller('televisions')
export class TelevisionsController {
  constructor(private readonly televisionsService: TelevisionsService) {}

  // @Post()
  // create(@Body() createTelevisionDto: CreateTelevisionDto) {
  //   return this.televisionsService.create(createTelevisionDto);
  // }

  // Parc complet, codeConnection inclus : réservé aux ADMIN.
  // Un utilisateur standard passe par GET /televisions/me.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  findAll(@Query() query: QueryTelevisionDto) {
    // return this.televisionsService.findAll(query);
    return this.televisionsService.findAll();
  }

  // Parc complet enrichi (utilisateur propriétaire, playlists, médias) : ADMIN uniquement.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('/dashboard')
  findAllDashboard(@Query() query: QueryTelevisionDto) {
    // return this.televisionsService.findAll(query);
    return this.televisionsService.findAllDashboard();
  }

  // Route d'appairage appelée par l'écran lui-même, avant toute authentification :
  // elle doit rester ouverte, sinon aucun écran ne peut se connecter.
  @Post('/check')
  checkCode(@Body() data: any) {
    return this.televisionsService.checkCodeOrCreate(data);
  }
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  MyTVs(@GetUser() user: any) {
    return this.televisionsService.MyTVs(user);
  }

  // Compteurs sur l'ensemble du parc : ADMIN uniquement.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('statistics')
  getStatistics() {
    return this.televisionsService.getStatistics();
  }

  // Déclarée avant @Get(':id') : le segment paramétrique ne doit pas capturer l'URL.
  @UseGuards(JwtAuthGuard)
  @Get(':tvId/queue')
  getQueue(@Param('tvId', ParseUUIDPipe) tvId: string, @GetUser() user: any) {
    return this.televisionsService.getQueue(tvId, user);
  }

  // @Get('device/:deviceId')
  // findByDeviceId(@Param('deviceId') deviceId: string) {
  //   return this.televisionsService.findByDeviceId(deviceId);
  // }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTelevisionDto: UpdateTelevisionDto,
  ) {
    return this.televisionsService.update(id, updateTelevisionDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':tvId/user/dissociated')
  dissociatedUserToTV(@Param('tvId') tvId: string, @GetUser() user: any) {
    console.log("🚀 ~ TelevisionsController ~ dissociatedUserToTV ~ tvId:", tvId)
    return this.televisionsService.dissociatedUserToTV(tvId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.televisionsService.updateStatus(id, status);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.televisionsService.deleteTelevisionWithCleanup(id, user);
  }
}
