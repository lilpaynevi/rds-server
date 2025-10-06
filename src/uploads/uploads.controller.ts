import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Res,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Response } from 'express';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('media/*path')
  serveMedia(@Param('path') params: string, @Res() res: Response) {
    try {
      let filePath: string;

      if (Array.isArray(params)) {
        filePath = params.join('/'); // Joindre les segments avec '/'
      } else {
        filePath = params;
      }

      console.log('🚀 ~ UploadsController ~ serveMedia ~ filePath:', filePath);
      const fullPath = join(process.cwd(), 'uploads', 'media', filePath);

      console.log('📁 Lecture fichier:', fullPath);

      // Vérifier si le fichier existe
      if (!existsSync(fullPath)) {
        throw new HttpException('Fichier non trouvé', HttpStatus.NOT_FOUND);
      }

      // Lire le fichier
      const fileBuffer = readFileSync(fullPath);

      // Déterminer le type de contenu et l'extension
      const extension = filePath.split('.').pop().toLowerCase();
      const contentType = this.getContentType(extension);

      // Configuration des en-têtes selon le type de fichier
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      };

      // Pour les PDFs, ajouter des en-têtes spécifiques pour l'affichage inline
      if (extension === 'pdf') {
        headers['Content-Disposition'] = 'inline'; // PAS 'attachment'
        headers['Accept-Ranges'] = 'bytes';
        headers['Access-Control-Allow-Origin'] = '*';
        headers['Access-Control-Allow-Methods'] = 'GET';
        headers['Access-Control-Allow-Headers'] = 'Range';
        headers['Cross-Origin-Embedder-Policy'] = 'credentialless';
        headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
      }

      // Envoyer le fichier
      res.set(headers);
      res.send(fileBuffer);
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
