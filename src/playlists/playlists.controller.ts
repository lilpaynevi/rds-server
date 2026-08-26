import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GetUser } from 'src/decorator/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import {
  cleanupTempUploads,
  MAX_UPLOAD_FILES,
  mediaUploadOptions,
} from 'src/common/upload.config';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, mediaUploadOptions),
  )
  async create(
    @Body() createPlaylistDto: any,
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser() user: any,
  ) {
    console.log('🚀 ~ PlaylistsController ~ create ~ files:', files);
    // Parser les données si elles arrivent en string
    if (typeof createPlaylistDto === 'string') {
      createPlaylistDto = JSON.parse(createPlaylistDto);
    }

    try {
      return await this.playlistsService.create(
        createPlaylistDto.playlistData,
        user,
        files,
      );
    } finally {
      // Purge les fichiers tampon restés sur disque en cas d'échec
      await cleanupTempUploads(files);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create/multiple')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, mediaUploadOptions),
  )
  async createMultiple(
    @Body() createPlaylistDto: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    console.log('🚀 ~ PlaylistsController ~ create ~ files:', files);
    // Parser les données si elles arrivent en string
    if (typeof createPlaylistDto === 'string') {
      createPlaylistDto = JSON.parse(createPlaylistDto);
    }

    try {
      return await this.playlistsService.createMultiple(
        createPlaylistDto.playlistData,
        files,
      );
    } finally {
      await cleanupTempUploads(files);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  findAll(@GetUser() user: any) {
    return this.playlistsService.myPlaylists(user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/media/:mediaId')
  remove(@Param('mediaId') id: string) {
    return this.playlistsService.removeMedia(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playlistsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  removePlaylist(@Param('id') id: string) {
    return this.playlistsService.removePlaylist(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, mediaUploadOptions),
  )
  async update(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      return await this.playlistsService.update(
        id,
        updatePlaylistDto,
        user,
        files,
      );
    } finally {
      await cleanupTempUploads(files);
    }
  }

  /**
   * Assignation en lot : le client envoie l'état final voulu
   * (`televisionIds`), le service calcule lui-même les ajouts et retraits.
   */
  @UseGuards(JwtAuthGuard)
  @Put('/:playlistId/televisions')
  setPlaylistTelevisions(
    @Param('playlistId') playlistId: string,
    @Body() data: { televisionIds: string[] },
    @GetUser() user: any,
  ) {
    return this.playlistsService.setPlaylistTelevisions(
      playlistId,
      data?.televisionIds ?? [],
      user,
    );
  }

  /**
   * Même traitement en POST : le dashboard (AssignTVDialog dans
   * rds-dashboard/src/pages/playlists/myPlaylists.tsx) poste déjà sur cette
   * URL. Alias à supprimer dès que le client sera passé en PUT.
   */
  @UseGuards(JwtAuthGuard)
  @Post('/:playlistId/televisions')
  setPlaylistTelevisionsViaPost(
    @Param('playlistId') playlistId: string,
    @Body() data: { televisionIds: string[] },
    @GetUser() user: any,
  ) {
    return this.playlistsService.setPlaylistTelevisions(
      playlistId,
      data?.televisionIds ?? [],
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/:playlistId/televisionId/:televisionId/status')
  changeActivePlaylist(
    @Param('televisionId') televisionId: string,
    @Param('playlistId') playlistId: string,
    @Body() data: { isActive: boolean; position?: number },
  ) {
    return this.playlistsService.changeActivePlaylist(
      playlistId,
      televisionId,
      data,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/:playlistId/media/:mediaId/duration')
  changeDurationMedia(
    @Param('mediaId') mediaId: string,
    @Param('playlistId') playlistId: string,
    @Body() data,
  ) {
    return this.playlistsService.changeDurationMedia(
      playlistId,
      mediaId,
      data,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/:playlistId/media/:mediaId/orientation')
  changeOrientationMedia(
    @Param('mediaId') mediaId: string,
    @Param('playlistId') playlistId: string,
    @Body() data: { orientation: 'AUTO' | 'LANDSCAPE' | 'PORTRAIT' },
  ) {
    return this.playlistsService.changeOrientationMedia(
      playlistId,
      mediaId,
      data,
    );
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(JwtAuthGuard)
  @Patch('/:playlistId/media/:mediaId/rotation')
  changeRotationMedia(
    @Param('mediaId') mediaId: string,
    @Param('playlistId') playlistId: string,
    @Body() data: { rotation: number },
  ) {
    return this.playlistsService.changeRotationMedia(playlistId, mediaId, data);
  }

  @Patch('/:playlistId/assign-tv')
  assignPlaylistToTV(
    @Body() data: { televisionId: string; playlistId: string },
  ) {
    return this.playlistsService.assignPlaylistToTV(data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:playlistId/unassign-tv/:televisionId')
  removePlaylistFromTV(
    @Param('playlistId') playlistId: string,
    @Param('televisionId') televisionId: string,
  ) {
    return this.playlistsService.removePlaylistFromTV(playlistId, televisionId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/:playlistId/reorder')
  orderPlaylistToTV(
    @Param('playlistId') playlistId: string,
    @Body() data: { mediaId: string; order: number }[],
  ) {
    // Le playlistId de l'URL sert à borner la réécriture des ordres à cette
    // seule playlist (un média peut appartenir à plusieurs playlists).
    return this.playlistsService.reorderPlaylistToTV(data, playlistId);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.playlistsService.remove(+id);
  // }
}
