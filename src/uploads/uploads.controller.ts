import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { join } from 'path';
import { existsSync, statSync, createReadStream } from 'fs';
import { Request, Response } from 'express';

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v']);

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('media/*path')
  serveMedia(@Param('path') params: string, @Req() req: Request, @Res() res: Response) {
    try {
      const filePath = Array.isArray(params) ? params.join('/') : params;
      const fullPath = join(process.cwd(), 'uploads', 'media', filePath);

      if (!existsSync(fullPath)) {
        throw new HttpException('Fichier non trouvé', HttpStatus.NOT_FOUND);
      }

      const extension = filePath.split('.').pop().toLowerCase();
      const contentType = this.getContentType(extension);
      const { size: fileSize } = statSync(fullPath);

      // Support HTTP Range requests (requis par iOS AVPlayer pour les vidéos)
      if (VIDEO_EXTENSIONS.has(extension)) {
        const rangeHeader = req.headers['range'];

        if (rangeHeader) {
          const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
          const start = parseInt(startStr, 10);
          const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          });

          createReadStream(fullPath, { start, end }).pipe(res);
        } else {
          res.set({
            'Content-Type': contentType,
            'Content-Length': fileSize.toString(),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          });
          createReadStream(fullPath).pipe(res);
        }
        return;
      }

      // Fichiers non-vidéo (images, PDF…)
      res.set({
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'public, max-age=3600',
        ...(extension === 'pdf' && {
          'Content-Disposition': 'inline',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Range',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        }),
      });
      createReadStream(fullPath).pipe(res);
    } catch (error) {
      console.error('❌ Erreur:', error);
      res.status(500).send('Erreur serveur');
    }
  }

  private getContentType(extension: string): string {
    const types = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',

      // Vidéos
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',

      // PDF
      pdf: 'application/pdf',

      // Documents
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    };

    return types[extension] || 'application/octet-stream';
  }
}
