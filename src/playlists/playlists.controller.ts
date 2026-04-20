import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB par fichier
      // fileFilter: (req, file, cb) => {
      //   // Accepter images et vidéos
      //   if (file.mimetype.match(/\/(jpg|jpeg|png|gif|mp4|mov|avi)$/)) {
      //     cb(null, true);
      //   } else {
      //     cb(new Error('Type de fichier non supporté'), false);
      //   }
      // },
    }),
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

    return await this.playlistsService.create(
      createPlaylistDto.playlistData,
      user,
      files,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create/multiple')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB par fichier
      // fileFilter: (req, file, cb) => {
      //   // Accepter images et vidéos
      //   if (file.mimetype.match(/\/(jpg|jpeg|png|gif|mp4|mov|avi)$/)) {
      //     cb(null, true);
      //   } else {
      //     cb(new Error('Type de fichier non supporté'), false);
      //   }
      // },
    }),
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

    return await this.playlistsService.createMultiple(
      createPlaylistDto.playlistData,
      files,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  findAll(@GetUser() user: any) {
    return this.playlistsService.myPlaylists(user);
  }

  @Delete('/media/:mediaId')
  remove(@Param('mediaId') id: string) {
    return this.playlistsService.removeMedia(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playlistsService.findOne(id);
  }

  @Delete(':id')
  removePlaylist(@Param('id') id: string) {
    return this.playlistsService.removePlaylist(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB par fichier
      // fileFilter: (req, file, cb) => {
      //   // Accepter images et vidéos
      //   if (file.mimetype.match(/\/(jpg|jpeg|png|gif|mp4|mov|avi)$/)) {
      //     cb(null, true);
      //   } else {
      //     cb(new Error('Type de fichier non supporté'), false);
      //   }
      // },
    }),
  )
  update(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.playlistsService.update(id, updatePlaylistDto, user, files);
  }

  @Patch('/:playlistId/televisionId/:televisionId/status')
  changeActivePlaylist(
    @Param('televisionId') televisionId: string,
    @Param('playlistId') playlistId: string,
    @Body() data,
  ) {
    return this.playlistsService.changeActivePlaylist(
      playlistId,
      televisionId,
      data,
    );
  }

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

  @Patch('/:playlistId/assign-tv')
  assignPlaylistToTV(
    @Body() data: { televisionId: string; playlistId: string },
  ) {
    return this.playlistsService.assignPlaylistToTV(data);
  }

  @Delete('/:playlistId/unassign-tv/:televisionId')
  removePlaylistFromTV(
    @Param('playlistId') playlistId: string,
    @Param('televisionId') televisionId: string,
  ) {
    return this.playlistsService.removePlaylistFromTV(playlistId, televisionId);
  }

  @Patch('/:playlistId/reorder')
  orderPlaylistToTV(@Body() data: { mediaId: string; order: number }[]) {
    return this.playlistsService.reorderPlaylistToTV(data);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.playlistsService.remove(+id);
  // }
}
