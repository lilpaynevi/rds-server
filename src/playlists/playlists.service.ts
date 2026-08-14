// playlist.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { persistUploadedFile } from 'src/common/upload.config';

/**
 * Dimensions d'un média, telles que fournies par l'app à l'upload.
 *
 * Le serveur ne décode aucun fichier : sans ces valeurs, `Media.width/height`
 * restent nuls et la TV doit deviner l'orientation à la lecture. Toute valeur
 * absente, non numérique ou négative est ramenée à `null` — mieux vaut pas de
 * dimension qu'une dimension fausse, qui ferait pivoter un média à tort.
 */
function pickDimensions(source: any): {
  width: number | null;
  height: number | null;
} {
  const toDimension = (value: any): number | null => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const width = toDimension(source?.width);
  const height = toDimension(source?.height);

  // Une seule des deux dimensions ne permet pas de déduire une orientation
  return width && height ? { width, height } : { width: null, height: null };
}

/**
 * Le multipart ne transporte que du texte : le tableau de dimensions arrive
 * sérialisé (ou pas du tout, si l'app est d'une version antérieure).
 */
function parseDimensions(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('⚠️ Champ "dimensions" illisible, ignoré');
    return [];
  }
}
import { PrismaService } from 'src/prisma/prisma.service';
import { error } from 'console';
import { Socket } from 'socket.io';
import { WebsocketsGateway } from 'src/websockets/websockets.gateway';

@Injectable()
export class PlaylistsService {
  constructor(
    private prisma: PrismaService,
    private websocket: WebsocketsGateway,
  ) {}

  async create(
    createPlaylistDto: any,
    user: any,
    files?: Express.Multer.File[],
  ) {
    console.log('🚀 ~ PlaylistsService ~ create ~ files:', files);
    console.log(
      '🚀 ~ PlaylistsService ~ create ~ createPlaylistDto:',
      createPlaylistDto,
    );
    var parsedData = JSON.parse(createPlaylistDto);

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 1️⃣ VÉRIFIER que la télévision existe
      const television = await tx.television.findUnique({
        where: { id: parsedData.television },
      });

      if (!television) {
        throw new Error(
          `Télévision avec l'ID ${parsedData.television} introuvable`,
        );
      }

      console.log('✅ Télévision trouvée:', television.name);

      // ✅ 2️⃣ Vérifier que l'utilisateur peut accéder à cette TV
      const userTv = await tx.television.findFirst({
        where: {
          userId: user.sub,
          id: parsedData.television,
        },
      });

      if (!userTv) {
        throw new Error("Vous n'avez pas accès à cette télévision");
      }

      // 3️⃣ Créer la playlist (relation corrigée selon votre schéma)
      const playlist = await tx.playlist.create({
        data: {
          name: parsedData.titre,
          description: `Playlist avec ${parsedData.items.length} médias`,
          isActive: parsedData.isActive,
          shuffleMode: false,
          repeatMode: 'LOOP',
          userId: user.sub,
        },
      });

      console.log('✅ Playlist créée:', playlist.id);

      // 4️⃣ Créer la relation playlist-television séparément
      await tx.playlistTelevision.create({
        data: {
          playlistId: playlist.id,
          televisionId: parsedData.television,
        },
      });

      console.log('✅ Relation playlist-television créée');

      // 5️⃣ Traiter les médias
      const createdItems = [];

      for (let i = 0; i < files.length; i++) {
        const item = parsedData.items[i];
        const file = files ? files[i] : null;

        let mediaId = null;

        if (file) {
          const uploadDir = join(
            process.cwd(),
            'uploads',
            'media',
            user.sub,
            parsedData.television,
          );
          if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
          }

          // ✅ MODIFICATION: Extraction sécurisée de l'extension
          const getFileExtension = (filename, mimetype) => {
            console.log(
              '🔍 Debug extension - filename:',
              filename,
              'mimetype:',
              mimetype,
            );

            if (filename && filename.includes('.')) {
              const ext = filename.split('.').pop().toLowerCase();
              console.log('📝 Extension extraite du nom:', ext);
              return ext;
            }

            // Fallback basé sur le mimetype si pas d'extension dans le nom
            switch (mimetype) {
              case 'application/pdf':
                return 'pdf';
              case 'image/jpeg':
                return 'jpg';
              case 'image/png':
                return 'png';
              case 'image/gif':
                return 'gif';
              case 'image/webp':
                return 'webp';
              case 'video/mp4':
                return 'mp4';
              case 'video/quicktime':
                return 'mov';
              case 'video/webm':
                return 'webm';
              case 'video/avi':
                return 'avi';
              default:
                return 'bin';
            }
          };

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2);

          // ✅ UTILISATION de la fonction sécurisée
          const extension = getFileExtension(item.fileName, file.mimetype);
          const uniqueFileName = `${timestamp}_${randomId}.${extension}`;
          const filePath = join(uploadDir, uniqueFileName);

          console.log('📁 Traitement fichier:', {
            original: item.fileName,
            mimetype: file.mimetype,
            extension: extension,
            unique: uniqueFileName,
          });

          // Déplace le fichier tampon écrit par multer (pas de buffer en mémoire)
          await persistUploadedFile(file, filePath);

          // MODIFICATION: Fonction pour déterminer le mimeType
          const getMimeType = (type, extension) => {
            switch (type.toLowerCase()) {
              case 'video':
                return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
              case 'pdf':
                return 'application/pdf';
              case 'image':
              default:
                switch (extension) {
                  case 'png':
                    return 'image/png';
                  case 'gif':
                    return 'image/gif';
                  case 'webp':
                    return 'image/webp';
                  case 'jpg':
                  case 'jpeg':
                  default:
                    return 'image/jpeg';
                }
            }
          };

          // MODIFICATION: Fonction pour déterminer la durée par défaut
          const getDefaultDuration = (type) => {
            switch (type.toLowerCase()) {
              case 'pdf':
                return 5000; // 5 secondes par page
              case 'image':
                return 3000; // 3 secondes
              case 'video':
              default:
                return null; // La durée vidéo sera déterminée par le fichier
            }
          };

          const { width, height } = pickDimensions(item);

          const media = await tx.media.create({
            data: {
              title: item.fileName.split('.')[0],
              filename: uniqueFileName,
              originalName: item.fileName,
              s3Key: uniqueFileName,
              s3Url: `/uploads/media/${user.sub}/${parsedData.television}/${uniqueFileName}`,
              mimeType: getMimeType(item.type, extension), // MODIFIÉ
              fileSize: file.size,
              width,
              height,
              type: item.type.toUpperCase(), // PDF, IMAGE, VIDEO
              duration: item.duration ? Math.round(item.duration * 1000) : null, // Durée en ms
              userId: user.sub,
              status: 'ACTIVE',
            },
          });

          mediaId = media.id;

          if (mediaId) {
            const playlistItem = await tx.playlistItem.create({
              data: {
                playlistId: playlist.id,
                mediaId: mediaId,
                order: i + 1,
                // MODIFIÉ: Durée pour playlistItem en millisecondes
                duration: item.duration
                  ? Math.round(item.duration * 1000)
                  : getDefaultDuration(item.type),
              },
            });

            createdItems.push(playlistItem);
          }
        }
      }

      // 6️⃣ Créer le planning si nécessaire
      let schedule = null;
      console.log(parsedData?.schedule?.daysOfWeek);
      if (parsedData?.schedule?.daysOfWeek?.length > 0) {
        schedule = await tx.schedule.create({
          data: {
            title: `Planning - ${parsedData.titre}`,
            description: `Programmation pour ${parsedData.titre}`,
            startDate: parsedData.schedule.startDate,
            endDate: parsedData.schedule.endDate,
            // startTime/endTime sont obligatoires en base : sans repli, une
            // charge utile sans horaires fait échouer toute la transaction,
            // donc la création de la playlist entière. Journée complète par
            // défaut, cohérent avec "diffuser ces jours-là".
            startTime: parsedData.schedule.startTime || '00:00',
            endTime: parsedData.schedule.endTime || '23:59',
            daysOfWeek: parsedData.schedule.daysOfWeek,
            isActive: true,
            priority: 5,
            userId: user.sub,
            televisionId: parsedData.television,
            playlistId: playlist.id,
          },
        });
      }

      return {
        playlist,
        items: createdItems,
        schedule,
        summary: {
          totalItems: createdItems.length,
          playlistId: playlist.id,
          televisionId: parsedData.television,
        },
      };
    }).then(async (result) => {
      if (parsedData.isActive === true) {
        await this.websocket.changePlaylistForTV(
          parsedData.television,
          result.playlist.id,
        );
      }
      return result;
    });
  }

  async createMultiple(createPlaylistDto: any, files?: Express.Multer.File[]) {
    console.log('🚀 ~ PlaylistsService ~ create ~ files:', files);
    console.log(
      '🚀 ~ PlaylistsService ~ create ~ createPlaylistDto:',
      createPlaylistDto,
    );

    var parsedData = JSON.parse(createPlaylistDto);

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 1️⃣ VÉRIFIER que toutes les télévisions existent
      const televisionIds = Array.isArray(parsedData.televisions)
        ? parsedData.televisions
        : [parsedData.television];

      if (!televisionIds || televisionIds.length === 0) {
        throw new Error('Aucune télévision sélectionnée');
      }

      const televisions = await tx.television.findMany({
        where: {
          id: { in: televisionIds },
        },
      });

      if (televisions.length !== televisionIds.length) {
        throw new Error(
          "Certaines télévisions sont introuvables ou vous n'y avez pas accès",
        );
      }

      console.log(`✅ ${televisions.length} télévision(s) trouvée(s)`);

      // ✅ 2️⃣ CRÉER LES MÉDIAS (une seule fois pour toutes les playlists)
      const createdMedias = [];

      console.log(`✅ ${createdMedias.length} média(s) créé(s)`);

      // ✅ 3️⃣ CRÉER UNE PLAYLIST POUR CHAQUE TÉLÉVISION
      const results = [];

      for (const television of televisions) {
        console.log(`🔄 Création playlist pour TV: ${television.name}`);

        const findTV = await this.prisma.television.findUnique({
          where: {
            id: television.id,
          },
        });

        for (let i = 0; i < files.length; i++) {
          const item = parsedData.items[i];
          const file = files ? files[i] : null;

          if (file) {
            // Créer le dossier de base pour l'utilisateur
            const uploadDir = join(
              process.cwd(),
              'uploads',
              'media',
              findTV.userId,
            );
            if (!existsSync(uploadDir)) {
              await mkdir(uploadDir, { recursive: true });
            }

            // ✅ Fonction pour extraire l'extension
            const getFileExtension = (filename, mimetype) => {
              console.log(
                '🔍 Debug extension - filename:',
                filename,
                'mimetype:',
                mimetype,
              );

              if (filename && filename.includes('.')) {
                const ext = filename.split('.').pop().toLowerCase();
                console.log('📝 Extension extraite du nom:', ext);
                return ext;
              }

              // Fallback basé sur le mimetype
              switch (mimetype) {
                case 'application/pdf':
                  return 'pdf';
                case 'image/jpeg':
                  return 'jpg';
                case 'image/png':
                  return 'png';
                case 'image/gif':
                  return 'gif';
                case 'image/webp':
                  return 'webp';
                case 'video/mp4':
                  return 'mp4';
                case 'video/quicktime':
                  return 'mov';
                case 'video/webm':
                  return 'webm';
                case 'video/avi':
                  return 'avi';
                default:
                  return 'bin';
              }
            };

            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2);
            const extension = getFileExtension(item.name, file.mimetype);
            const uniqueFileName = `${timestamp}_${randomId}.${extension}`;
            const filePath = join(uploadDir, uniqueFileName);

            console.log('📁 Traitement fichier:', {
              original: item.name,
              mimetype: file.mimetype,
              extension: extension,
              unique: uniqueFileName,
            });

            // Déplace le fichier tampon écrit par multer (pas de buffer en mémoire)
            await persistUploadedFile(file, filePath);

            // Fonction pour déterminer le mimeType
            const getMimeType = (type, extension) => {
              switch (type.toLowerCase()) {
                case 'video':
                  return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
                case 'pdf':
                  return 'application/pdf';
                case 'image':
                default:
                  switch (extension) {
                    case 'png':
                      return 'image/png';
                    case 'gif':
                      return 'image/gif';
                    case 'webp':
                      return 'image/webp';
                    case 'jpg':
                    case 'jpeg':
                    default:
                      return 'image/jpeg';
                  }
              }
            };

            console.log('fefrfrfrfrfrfr: ', item);
            const { width, height } = pickDimensions(item);

            const media = await tx.media.create({
              data: {
                title: item.name.split('.')[0],
                filename: uniqueFileName,
                originalName: item.name,
                s3Key: uniqueFileName,
                s3Url: `/uploads/media/${findTV.userId}/${uniqueFileName}`,
                mimeType: getMimeType(item.type, extension),
                fileSize: file.size,
                width,
                height,
                type: item.type.toUpperCase(),
                duration: item.duration
                  ? Math.round(item.duration * 1000)
                  : null,
                userId: findTV.userId,
                status: 'ACTIVE',
              },
            });

            createdMedias.push({
              media,
              originalItem: item,
              order: i + 1,
            });
          }
        }

        // Créer la playlist
        const playlist = await tx.playlist.create({
          data: {
            name: `${parsedData.titre} - ${television.name}`,
            description: `Playlist avec ${createdMedias.length} médias pour ${television.name}`,
            isActive: parsedData.isActive,
            shuffleMode: false,
            repeatMode: 'LOOP',
            userId: findTV.userId,
          },
        });

        console.log(`✅ Playlist créée pour ${television.name}:`, playlist.id);

        // Créer la relation playlist-television
        await tx.playlistTelevision.create({
          data: {
            playlistId: playlist.id,
            televisionId: television.id,
            isActive: true,
            priority: 5,
          },
        });

        // Créer les items de playlist
        const playlistItems = [];

        const getDefaultDuration = (type) => {
          switch (type.toLowerCase()) {
            case 'pdf':
              return 5000;
            case 'image':
              return 3000;
            case 'video':
            default:
              return null;
          }
        };

        for (const mediaData of createdMedias) {
          const playlistItem = await tx.playlistItem.create({
            data: {
              playlistId: playlist.id,
              mediaId: mediaData.media.id,
              order: mediaData.order,
              duration: mediaData.originalItem.duration
                ? Math.round(mediaData.originalItem.duration * 1000)
                : getDefaultDuration(mediaData.originalItem.type),
            },
          });

          playlistItems.push(playlistItem);
        }

        // ✅ 4️⃣ CRÉER LE PLANNING si nécessaire (un par TV)
        let schedule = null;
        if (parsedData?.schedule?.daysOfWeek?.length > 0) {
          schedule = await tx.schedule.create({
            data: {
              title: `Planning - ${parsedData.titre} - ${television.name}`,
              description: `Programmation pour ${parsedData.titre} sur ${television.name}`,
              startDate: parsedData.schedule.startDate,
              endDate: parsedData.schedule.endDate,
              startTime: parsedData.schedule.startTime,
              endTime: parsedData.schedule.endTime,
              daysOfWeek: parsedData.schedule.daysOfWeek,
              isActive: true,
              priority: 5,
              userId: findTV.userId,
              televisionId: television.id,
              playlistId: playlist.id,
            },
          });
        }

        results.push({
          television,
          playlist,
          items: playlistItems,
          schedule,
          mediaCount: createdMedias.length,
        });

        // Notifier la TV en temps réel si un schedule a été créé
        if (schedule) {
          this.websocket.notifyTV(television.id, 'tv-schedules-updated', {
            message: 'Nouvelle programmation disponible',
          });
        }

        console.log(`✅ Playlist complète créée pour ${television.name}`);
      }

      // ✅ 5️⃣ RÉSUMÉ GLOBAL
      const totalDuration = createdMedias.reduce((sum, mediaData) => {
        return (
          sum +
          (mediaData.originalItem.duration
            ? Math.round(mediaData.originalItem.duration * 1000)
            : 3000)
        );
      }, 0);

      return {
        success: true,
        message: `${results.length} playlist(s) créée(s) avec succès`,
        results,
        summary: {
          playlistsCreated: results.length,
          televisionsConfigured: televisions.length,
          mediasCreated: createdMedias.length,
          totalDuration: totalDuration,
          televisionNames: televisions.map((tv) => tv.name),
          hasSchedule: !!parsedData?.schedule?.daysOfWeek?.length,
        },
      };
    });
  }

  async update(
    playlistId: string,
    updatePlaylistDto: any,
    user: any,
    files?: Express.Multer.File[],
  ) {
    console.log('🚀 ~ PlaylistsService ~ update ~ user:', user);
    console.log('🚀 ~ PlaylistsService ~ update ~ files:', files);
    console.log(
      '🚀 ~ PlaylistsService ~ update ~ updatePlaylistDto:',
      updatePlaylistDto,
    );
    const parsedData = updatePlaylistDto;

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 1️⃣ VÉRIFIER que la playlist existe et appartient à l'utilisateur
      const existingPlaylist = await tx.playlist.findFirst({
        where: {
          id: playlistId,
        },
        include: {
          items: {
            include: {
              media: true,
            },
            // orderBy: { order: 'asc' },
          },
          televisions: {
            include: {
              television: true,
            },
          },
          schedules: true,
        },
      });
      console.log(
        '🚀 ~ PlaylistsService ~ update ~ existingPlaylist:',
        existingPlaylist,
      );

      if (!existingPlaylist) {
        throw new Error('Playlist introuvable ou accès non autorisé');
      }

      console.log('✅ Playlist trouvée:', existingPlaylist.name);

      // ✅ 2️⃣ VÉRIFIER la télévision si elle a changé
      if (
        parsedData.television &&
        parsedData.television !==
          existingPlaylist.televisions?.[0]?.televisionId
      ) {
        const television = await tx.television.findFirst({
          where: {
            id: parsedData.television,
            userId: user.sub,
          },
        });

        if (!television) {
          throw new Error(
            `Télévision avec l'ID ${parsedData.television} introuvable ou accès non autorisé`,
          );
        }

        console.log('✅ Nouvelle télévision validée:', television.name);
      }

      // ✅ 3️⃣ METTRE À JOUR les informations de base de la playlist
      const updatedPlaylist = await tx.playlist.update({
        where: { id: playlistId },
        data: {
          name: parsedData.titre || parsedData.name || existingPlaylist.name,
          description: parsedData.nombreMedias
            ? `Playlist avec ${parsedData.nombreMedias} médias`
            : parsedData.description
              ? parsedData.description
              : existingPlaylist.description,
          shuffleMode: parsedData.shuffleMode ?? existingPlaylist.shuffleMode,
          repeatMode: parsedData.repeatMode || existingPlaylist.repeatMode,
          isActive: parsedData.isActive ?? existingPlaylist.isActive,
          updatedAt: new Date(),
        },
      });

      console.log('✅ Playlist mise à jour:', updatedPlaylist.id);

      // ✅ 4️⃣ GÉRER le changement de télévision
      if (
        parsedData.television &&
        parsedData.television !==
          existingPlaylist.televisions?.[0]?.televisionId
      ) {
        // Supprimer l'ancienne relation
        await tx.playlistTelevision.deleteMany({
          where: { playlistId: playlistId },
        });

        // Créer la nouvelle relation
        await tx.playlistTelevision.create({
          data: {
            playlistId: playlistId,
            televisionId: parsedData.television,
          },
        });

        console.log('✅ Relation télévision mise à jour');
      }

      const updatedItems = [];
      const processedMediaIds = [];

      // Dimensions envoyées par l'app, alignées sur l'ordre des fichiers.
      // Multipart ne transporte que du texte : le champ arrive sérialisé.
      const uploadedDimensions: { width?: number; height?: number }[] =
        parseDimensions(parsedData.dimensions);

      // ✅ 5️⃣ TRAITER les médias (nouveaux, modifiés, supprimés)
      // ✅ 5️⃣ TRAITER les médias (nouveaux, modifiés, supprimés)
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          const televisionId =
            parsedData.television ||
            existingPlaylist.televisions?.find((t) => t.televisionId != null)
              ?.televisionId ||
            'shared';

          const uploadDir = join(
            process.cwd(),
            'uploads',
            'media',
            user.sub,
            televisionId,
          );

          if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
          }

          // ✅ MODIFICATION: Extraction sécurisée de l'extension
          const getFileExtension = (filename, mimetype) => {
            console.log(
              '🔍 Debug extension - filename:',
              filename,
              'mimetype:',
              mimetype,
            );

            if (filename && filename.includes('.')) {
              const ext = filename.split('.').pop().toLowerCase();
              console.log('📝 Extension extraite du nom:', ext);
              return ext;
            }

            // Fallback basé sur le mimetype si pas d'extension dans le nom
            switch (mimetype) {
              case 'application/pdf':
                return 'pdf';
              case 'image/jpeg':
                return 'jpg';
              case 'image/png':
                return 'png';
              case 'image/gif':
                return 'gif';
              case 'image/webp':
                return 'webp';
              case 'video/mp4':
                return 'mp4';
              case 'video/quicktime':
                return 'mov';
              case 'video/webm':
                return 'webm';
              case 'video/avi':
                return 'avi';
              default:
                return 'bin';
            }
          };

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2);

          // ✅ UTILISATION de la fonction sécurisée
          const extension = getFileExtension(file.originalname, file.mimetype);
          console.log('🚀 ~ PlaylistsService ~ update ~ extension:', extension);

          const uniqueFileName = `${timestamp}_${randomId}.${extension}`;
          console.log(
            '🚀 ~ PlaylistsService ~ update ~ uniqueFileName:',
            uniqueFileName,
          );

          const filePath = join(uploadDir, uniqueFileName);
          console.log('🚀 ~ PlaylistsService ~ update ~ filePath:', filePath);

          console.log('📁 Traitement fichier:', {
            original: file.originalname,
            mimetype: file.mimetype,
            extension: extension,
            unique: uniqueFileName,
          });

          // Déplace le fichier tampon écrit par multer (pas de buffer en mémoire)
          await persistUploadedFile(file, filePath);

          // MODIFICATION: Fonction pour déterminer le mimeType
          const getMimeType = (mimetype, extension) => {
            // Si mimetype est fourni et valide, l'utiliser
            if (mimetype && mimetype !== 'video' && mimetype !== 'image') {
              return mimetype;
            }

            // Sinon, déterminer par extension
            switch (extension) {
              case 'pdf':
                return 'application/pdf';
              case 'png':
                return 'image/png';
              case 'gif':
                return 'image/gif';
              case 'webp':
                return 'image/webp';
              case 'jpg':
              case 'jpeg':
                return 'image/jpeg';
              case 'mp4':
                return 'video/mp4';
              case 'mov':
                return 'video/quicktime';
              case 'webm':
                return 'video/webm';
              case 'avi':
                return 'video/x-msvideo';
              default:
                // Fallback basé sur le mimetype générique
                if (mimetype === 'video') return 'video/mp4';
                if (mimetype === 'image') return 'image/jpeg';
                return 'application/octet-stream';
            }
          };

          // MODIFICATION: Fonction pour déterminer le type
          const getMediaType = (mimetype, extension) => {
            switch (extension) {
              case 'pdf':
                return 'IMAGE';
              case 'png':
              case 'jpg':
              case 'jpeg':
              case 'gif':
              case 'webp':
                return 'IMAGE';
              case 'mp4':
              case 'mov':
              case 'webm':
              case 'avi':
                return 'VIDEO';
              default:
                // Fallback basé sur le mimetype
                if (mimetype === 'video') return 'VIDEO';
                if (mimetype === 'image') return 'IMAGE';
                return 'IMAGE'; // Défaut
            }
          };

          // MODIFICATION: Fonction pour déterminer la durée par défaut
          const getDefaultDuration = (type) => {
            switch (type) {
              case 'PDF':
                return 5000; // 5 secondes
              case 'IMAGE':
                return 3000; // 3 secondes
              case 'VIDEO':
              default:
                return null; // La durée vidéo sera déterminée par le fichier
            }
          };

          const mediaType = getMediaType(file.mimetype, extension);
          const { width, height } = pickDimensions(uploadedDimensions[i]);

          // Créer le nouveau média
          const media = await tx.media.create({
            data: {
              title: file.originalname.split('.')[0],
              filename: uniqueFileName,
              originalName: file.originalname,
              s3Key: uniqueFileName,
              s3Url: `/uploads/media/${user.sub}/${televisionId}/${uniqueFileName}`,
              mimeType: getMimeType(file.mimetype, extension), // MODIFIÉ
              fileSize: file.size,
              type: mediaType, // MODIFIÉ: PDF, IMAGE, VIDEO
              duration: null, // Sera mis à jour plus tard si nécessaire
              width,
              height,
              userId: user.sub,
              status: 'ACTIVE',
            },
          });

          const count = await tx.playlistItem.count({
            where: { playlistId },
          });

          // Créer l'item de playlist
          const playlistItem = await tx.playlistItem.create({
            data: {
              playlistId: playlistId,
              mediaId: media.id,
              order: existingPlaylist.items.length + i + 1,
              // AJOUT: Durée pour playlistItem en millisecondes
              duration: getDefaultDuration(mediaType),
            },
          });

          processedMediaIds.push(media.id);
          updatedItems.push(playlistItem);
          console.log(
            `✅ Nouveau média ${media.id} ajouté (Type: ${mediaType})`,
          );
        }
      }

      // ✅ 6️⃣ SUPPRIMER les items qui ne sont plus dans la nouvelle liste
      // const itemsToDelete = existingPlaylist.items.filter(
      //   (existing) => !processedMediaIds.includes(existing.mediaId),
      // );

      // if (itemsToDelete.length > 0) {
      //   const itemIdsToDelete = itemsToDelete.map((item) => item.id);
      //   const mediaIdsToDelete = itemsToDelete.map((item) => item.mediaId);

      //   // Supprimer les items de playlist
      //   await tx.playlistItem.deleteMany({
      //     where: {
      //       id: { in: itemIdsToDelete },
      //     },
      //   });

      //   // Supprimer les médias orphelins
      //   for (const mediaId of mediaIdsToDelete) {
      //     const mediaUsageCount = await tx.playlistItem.count({
      //       where: { mediaId: mediaId },
      //     });

      //     // Si le média n'est utilisé nulle part ailleurs, le supprimer
      //     if (mediaUsageCount === 0) {
      //       const mediaToDelete = await tx.media.findUnique({
      //         where: { id: mediaId },
      //       });

      //       if (mediaToDelete) {
      //         // Supprimer le fichier physique
      //         const filePath = join(
      //           process.cwd(),
      //           'uploads',
      //           mediaToDelete.s3Url.replace('/uploads/', ''),
      //         );
      //         try {
      //           if (existsSync(filePath)) {
      //             await unlink(filePath);
      //             console.log(`🗑️ Fichier supprimé: ${filePath}`);
      //           }
      //         } catch (error) {
      //           console.error(
      //             `❌ Erreur lors de la suppression du fichier: ${filePath}`,
      //             error,
      //           );
      //         }

      //         // Supprimer l'enregistrement en base
      //         await tx.media.delete({
      //           where: { id: mediaId },
      //         });
      //       }
      //     }
      //   }

      //   console.log(`🗑️ ${itemsToDelete.length} items supprimés`);
      // }

      // ✅ 7️⃣ GÉRER les plannings
      let schedule = null;

      if (parsedData.dateLancement && parsedData.heureLancement) {
        const [day, month, year] = parsedData.dateLancement.split('/');
        const startDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        // Vérifier s'il existe déjà un planning
        const existingSchedule = existingPlaylist.schedules?.[0];

        if (existingSchedule) {
          // Mettre à jour le planning existant
          schedule = await tx.schedule.update({
            where: { id: existingSchedule.id },
            data: {
              title: `Planning - ${parsedData.titre || existingPlaylist.name}`,
              description: `Programmation pour ${parsedData.titre || existingPlaylist.name}`,
              startDate: startDate,
              endDate: endDate,
              startTime: parsedData.heureLancement,
              endTime:
                parsedData.heureFin || existingSchedule.endTime || '23:59',
              daysOfWeek: parsedData.joursActifs ||
                existingSchedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
              priority: parsedData.priorite || existingSchedule.priority || 5,
              isActive:
                parsedData.planningActif ?? existingSchedule.isActive ?? true,
              updatedAt: new Date(),
            },
          });
          console.log('✅ Planning mis à jour');
        } else {
          // Créer un nouveau planning
          schedule = await tx.schedule.create({
            data: {
              title: `Planning - ${parsedData.titre || existingPlaylist.name}`,
              description: `Programmation pour ${parsedData.titre || existingPlaylist.name}`,
              startDate: startDate,
              endDate: endDate,
              // Même repli que dans create() : champs obligatoires en base
              startTime: parsedData.heureLancement || '00:00',
              endTime: parsedData.heureFin || '23:59',
              daysOfWeek: parsedData.joursActifs || [0, 1, 2, 3, 4, 5, 6],
              isActive: parsedData.planningActif ?? true,
              priority: parsedData.priorite || 5,
              userId: user.sub,
              televisionId:
                parsedData.television ||
                existingPlaylist.televisions?.[0]?.televisionId,
              playlistId: playlistId,
            },
          });
          console.log('✅ Nouveau planning créé');
        }
      }
      // Suppression du planning : uniquement sur demande EXPLICITE.
      // Se fier à l'absence de `dateLancement` effaçait la programmation à
      // chaque PATCH qui ne la mentionnait pas — donc à chaque ajout de média,
      // `handleUpload` n'envoyant que les fichiers.
      else if (
        (parsedData.removeSchedule === true ||
          parsedData.removeSchedule === 'true') &&
        existingPlaylist.schedules?.length > 0
      ) {
        await tx.schedule.deleteMany({
          where: {
            playlistId: playlistId,
            userId: user.sub,
          },
        });
        console.log('🗑️ Planning supprimé');
      }

      // ✅ 8️⃣ RETOURNER le résultat final
      const finalPlaylist = await tx.playlist.findUnique({
        where: { id: playlistId },
        include: {
          items: {
            include: {
              media: true,
            },
            // orderBy: { order: 'asc' },
          },
          televisions: {
            include: {
              television: true,
            },
          },
          schedules: true,
        },
      });

      return {
        success: true,
        message: 'Playlist mise à jour avec succès',
        playlist: finalPlaylist,
        changes: {
          itemsAdded: updatedItems.filter(
            (item) =>
              !existingPlaylist.items.find(
                (existing) => existing.id === item.id,
              ),
          ).length,
          itemsUpdated: updatedItems.filter((item) =>
            existingPlaylist.items.find((existing) => existing.id === item.id),
          ).length,
          // itemsRemoved: itemsToDelete.length,
          scheduleUpdated: !!schedule,
          televisionChanged:
            parsedData.television &&
            parsedData.television !==
              existingPlaylist.televisions?.[0]?.televisionId,
        },
        summary: {
          totalItems: finalPlaylist?.items.length || 0,
          playlistId: playlistId,
          televisionId:
            parsedData.television ||
            existingPlaylist.televisions?.[0]?.televisionId,
          hasSchedule: !!finalPlaylist?.schedules.length,
          lastUpdate: new Date().toISOString(),
        },
      };
    });
  }

  async myPlaylists(user: any) {
    const response = await this.prisma.playlist.findMany({
      where: {
        userId: user.sub,
      },
      include: {
        items: {
          select: {
            media: {
              select: {
                _count: true,
              },
            },
          },
        },
        televisions: {
          include: {
            television: {
              select: {
                name: true,
                id: true,
              },
            },
          },
        },
        schedules: true,
      },
    });
    return response;
  }

  async findOne(id: string) {
    return this.prisma.playlist.findUnique({
      where: {
        id,
      },
      include: {
        televisions: {
          select: {
            id: true,
            isActive: true,
            priority: true,
            televisionId: true,
            television: {
              select: {
                name: true,
                id: true,
              },
            },
          },
        },
        queueItems: {
          select: {
            televisionId: true,
            position: true,
          },
          orderBy: { position: 'asc' },
        },
        items: {
          select: {
            orientation: true,
            media: {
              select: {
                id: true,
                filename: true,
                s3Url: true,
                duration: true,
                width: true,
                height: true,
              },
            },
          },
        },
        schedules: true,
      },
    });
  }

  async removePlaylist(id: string) {
    return this.prisma.playlist.deleteMany({
      where: {
        id,
      },
    });
  }

  async removeMedia(id: string) {
    console.log('🚀 ~ PlaylistsService ~ removeMedia ~ id:', id);
    if (id) {
      const findUrlMedia = await this.prisma.media.findUnique({
        select: {
          s3Url: true,
        },
        where: {
          id,
        },
      });
      console.log(
        '🚀 ~ PlaylistsService ~ removeMedia ~ findUrlMedia:',
        findUrlMedia,
      );
      const uploadDir = join(process.cwd(), findUrlMedia.s3Url);
      await unlink(uploadDir);
    }

    return this.prisma.media.deleteMany({
      where: {
        id,
      },
    });
  }

  async changeActivePlaylist(
    playlistId: string,
    televisionId: string,
    data: { isActive: boolean; position?: number },
  ) {
    const result = await this.prisma.$transaction(async (prisma) => {
      // 1. Vérifier que la playlist existe et est liée à la télévision
      const playlistTelevision = await prisma.playlistTelevision.findUnique({
        where: {
          playlistId_televisionId: {
            playlistId,
            televisionId,
          },
        },
      });

      if (!playlistTelevision) {
        throw new Error(
          "Cette playlist n'est pas associée à la télévision spécifiée",
        );
      }

      // 2. Activer/désactiver la playlist elle-même
      const updatedPlaylist = await prisma.playlist.update({
        where: { id: playlistId },
        data: {
          isActive: data.isActive,
        },
        include: {
          televisions: true,
        },
      });

      // 3. Mettre à jour la relation PlaylistTelevision
      await prisma.playlistTelevision.update({
        where: {
          playlistId_televisionId: {
            playlistId,
            televisionId,
          },
        },
        data: {
          isActive: data.isActive,
        },
      });

      // 4. Répercuter sur la file d'attente de la TV — plusieurs playlists
      // peuvent désormais être actives en même temps, dans un ordre donné.
      if (data.isActive) {
        if (data.position !== undefined) {
          await prisma.playlistQueueItem.upsert({
            where: { playlistId_televisionId: { playlistId, televisionId } },
            create: {
              playlistId,
              televisionId,
              userId: updatedPlaylist.userId,
              position: data.position,
            },
            update: { position: data.position },
          });
        } else {
          const existing = await prisma.playlistQueueItem.findUnique({
            where: { playlistId_televisionId: { playlistId, televisionId } },
          });
          if (!existing) {
            const last = await prisma.playlistQueueItem.findFirst({
              where: { televisionId },
              orderBy: { position: 'desc' },
            });
            await prisma.playlistQueueItem.create({
              data: {
                playlistId,
                televisionId,
                userId: updatedPlaylist.userId,
                position: (last?.position ?? -1) + 1,
              },
            });
          }
        }
      } else {
        await prisma.playlistQueueItem.deleteMany({
          where: { playlistId, televisionId },
        });
      }

      return updatedPlaylist;
    });

    this.websocket.notifyTV(televisionId, 'tv-queue-updated', {});
    return result;
  }

  // playlists.service.ts

  async changeDurationMedia(
    playlistId: string,
    mediaId: string,
    data: { duration: number },
  ) {
    try {
      // Validation de la durée
      if (!data.duration || data.duration < 1000 || data.duration > 600000) {
        throw new BadRequestException(
          'La durée doit être entre 1 seconde (1000ms) et 10 minutes (600000ms)',
        );
      }

      // Vérifier que la playlist existe
      const playlist = await this.prisma.playlist.findUnique({
        where: { id: playlistId },
      });

      if (!playlist) {
        throw new NotFoundException('Playlist introuvable');
      }

      // Vérifier que le média existe dans la playlist
      const playlistMedia = await this.prisma.playlistItem.findFirst({
        where: {
          playlistId: playlistId,
          mediaId: mediaId,
        },
      });

      if (!playlistMedia) {
        throw new NotFoundException('Média introuvable dans cette playlist');
      }

      // Mettre à jour la durée
      const updatedPlaylistMedia = await this.prisma.media.update({
        where: {
          id: mediaId,
        },
        data: {
          duration: data.duration,
        },
      });

      // Mettre à jour le timestamp de la playlist
      await this.prisma.playlist.update({
        where: { id: playlistId },
        data: { updatedAt: new Date() },
      });

      return {
        success: true,
        message: 'Durée mise à jour avec succès',
        data: updatedPlaylistMedia,
      };
    } catch (error) {
      console.error('Erreur changeDurationMedia:', error);
      throw error;
    }
  }

  /**
   * Orientation d'affichage d'un média, propre à cette playlist : elle est
   * portée par le PlaylistItem (comme l'ordre), pas par le média lui-même, donc
   * le même fichier peut être orienté différemment d'une playlist à l'autre.
   */
  async changeOrientationMedia(
    playlistId: string,
    mediaId: string,
    data: { orientation: 'AUTO' | 'LANDSCAPE' | 'PORTRAIT' },
  ) {
    const ALLOWED = ['AUTO', 'LANDSCAPE', 'PORTRAIT'];

    if (!ALLOWED.includes(data?.orientation)) {
      throw new BadRequestException(
        `Orientation invalide. Valeurs acceptées : ${ALLOWED.join(', ')}`,
      );
    }

    const playlistItem = await this.prisma.playlistItem.findFirst({
      where: { playlistId, mediaId },
    });

    if (!playlistItem) {
      throw new NotFoundException('Média introuvable dans cette playlist');
    }

    const updated = await this.prisma.playlistItem.update({
      where: { id: playlistItem.id },
      data: { orientation: data.orientation },
    });

    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { updatedAt: new Date() },
    });

    // Notification ciblée : la TV corrige l'orientation du média sans recharger
    // la playlist ni repartir du premier média, contrairement à un
    // "tv-change-playlist".
    // On vise les TVs auxquelles la playlist est assignée *et* celles qui l'ont
    // dans leur file d'attente : une playlist peut être diffusée par l'un ou
    // l'autre chemin.
    const [assignments, queueEntries] = await Promise.all([
      this.prisma.playlistTelevision.findMany({
        where: { playlistId },
        select: { televisionId: true },
      }),
      this.prisma.playlistQueueItem.findMany({
        where: { playlistId },
        select: { televisionId: true },
      }),
    ]);

    const televisionIds = new Set(
      [...assignments, ...queueEntries]
        .map((entry) => entry.televisionId)
        .filter((id): id is string => Boolean(id)),
    );

    televisionIds.forEach((televisionId) =>
      this.websocket.notifyTV(televisionId, 'tv-media-orientation-updated', {
        playlistId,
        mediaId,
        orientation: data.orientation,
      }),
    );

    return {
      success: true,
      message: 'Orientation mise à jour avec succès',
      data: updated,
    };
  }

  async assignPlaylistToTV(data: { televisionId: string; playlistId: string }) {
    try {
      // Vérifier si l'assignation existe déjà
      const existingAssignment =
        await this.prisma.playlistTelevision.findUnique({
          where: {
            playlistId_televisionId: {
              playlistId: data.playlistId,
              televisionId: data.televisionId,
            },
          },
        });
      console.log(
        '🚀 ~ PlaylistsService ~ assignPlaylistToTV ~ existingAssignment:',
        existingAssignment,
      );

      if (existingAssignment) {
        // Si l'assignation existe, la réactiver
        console.log("Si l'assignation existe, la réactiver");
        return await this.prisma.playlistTelevision.update({
          where: {
            id: existingAssignment.id,
          },
          data: {
            isActive: true,
            priority: 5,
            assignedAt: new Date(),
          },
          include: {
            playlist: true,
            television: true,
          },
        });
      } else {
        // Créer une nouvelle assignation (sans supprimer les autres)
        console.log('🚀 ~ Créer une nouvelle assignation many-to-many');
        return await this.prisma.playlistTelevision.create({
          data: {
            playlistId: data.playlistId,
            televisionId: data.televisionId,
            isActive: true,
            priority: 5,
          },
          include: {
            playlist: true,
            television: true,
          },
        });
      }
    } catch (error) {
      throw new Error(
        `Erreur lors de l'assignation de la playlist à la TV: ${error.message}`,
      );
    }
  }

  async removePlaylistFromTV(playlistId: string, televisionId: string) {
    // Retire aussi l'entrée de la file d'attente — sans ça, la TV continuerait
    // de jouer une playlist qui n'est plus censée lui être assignée.
    const { count } = await this.prisma.playlistQueueItem.deleteMany({
      where: { playlistId, televisionId },
    });
    const result = await this.prisma.playlistTelevision.deleteMany({
      where: { playlistId, televisionId },
    });
    if (count > 0) {
      this.websocket.notifyTV(televisionId, 'tv-queue-updated', {});
    }
    return result;
  }

  async reorderPlaylistToTV(data: { mediaId: string; order: number }[]) {
    console.log('🚀 ~ PlaylistsService ~ reorderPlaylistToTV ~ data:', data);
    const result = await this.prisma.$transaction(async (prisma) => {
      const updatePromises = data.map(async (item) => {
        const whereClause: any = {
          id: item.mediaId,
        };

        const findInPlaylistItems = await prisma.media.findFirst({
          where: whereClause,
        });
        console.log(
          '🚀 ~ PlaylistsService ~ reorderPlaylistToTV ~ findInPlaylistItems:',
          findInPlaylistItems,
        );

        const updateResult = await prisma.playlistItem.updateMany({
          where: {
            mediaId: findInPlaylistItems.id,
          },
          data: {
            order: item.order,
          },
        });

        console.log(
          `📝 Mise à jour item ${item.mediaId}: ${updateResult.count} enregistrement(s) modifié(s)`,
        );

        return {
          mediaId: item.mediaId,
          newOrder: item.order,
          updated: updateResult.count > 0,
          affectedRows: updateResult.count,
        };
      });

      const updateResults = await Promise.all(updatePromises);

      return updateResults;
    });
  }
}
