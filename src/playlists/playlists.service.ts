// playlist.service.ts
import { Injectable } from '@nestjs/common';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { error } from 'console';

@Injectable()
export class PlaylistsService {
  constructor(private prisma: PrismaService) {}

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

          await writeFile(filePath, file.buffer);

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

          const media = await tx.media.create({
            data: {
              title: item.fileName.split('.')[0],
              filename: uniqueFileName,
              originalName: item.fileName,
              s3Key: uniqueFileName,
              s3Url: `/uploads/media/${user.sub}/${parsedData.television}/${uniqueFileName}`,
              mimeType: getMimeType(item.type, extension), // MODIFIÉ
              fileSize: file.size,
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
            startTime: parsedData.schedule.startTime,
            endTime: parsedData.schedule.endTime,
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
    });
  }

  async update(
    playlistId: string,
    updatePlaylistDto: any,
    user: any,
    files?: Express.Multer.File[],
  ) {
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
          userId: user.sub,
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

      // ✅ 5️⃣ TRAITER les médias (nouveaux, modifiés, supprimés)
      // ✅ 5️⃣ TRAITER les médias (nouveaux, modifiés, supprimés)
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          const televisionId =
            parsedData.television ||
            existingPlaylist.televisions?.[0]?.televisionId;

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

          await writeFile(filePath, file.buffer);

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
              startTime: parsedData.heureLancement,
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
      // Si plus de planning demandé, supprimer l'existant
      else if (
        !parsedData.dateLancement &&
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
            television: {
              select: {
                name: true,
                id: true,
              },
            },
          },
        },
        items: {
          select: {
            media: {
              select: {
                id: true,
                filename: true,
                s3Url: true,
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
    data: { isActive: boolean },
  ) {
    return await this.prisma.$transaction(async (prisma) => {
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

      // 2. Désactiver TOUTES les playlists actives pour cette télévision
      var ppp = await prisma.playlist.updateMany({
        where: {
          isActive: true,
          televisions: {
            some: {
              televisionId,
            },
          },
        },
        data: {
          isActive: false,
        },
      });
      console.log('🚀 ~ PlaylistsService ~ changeActivePlaylist ~ ppp:', ppp);

      // 3. Activer la playlist sélectionnée
      const updatedPlaylist = await prisma.playlist.update({
        where: { id: playlistId },
        data: {
          isActive: data.isActive,
        },
        include: {
          televisions: true,
        },
      });

      // 4. Mettre à jour la relation PlaylistTelevision (optionnel)
      await prisma.playlistTelevision.update({
        where: {
          playlistId_televisionId: {
            playlistId,
            televisionId,
          },
        },
        data: {
          isActive: true,
        },
      });

      return updatedPlaylist;
    });
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
        // Créer une nouvelle assignation
        await this.prisma.playlistTelevision.deleteMany({
          where: {
            playlistId: data.playlistId,
          },
        });

        console.log(
          '🚀 ~ Créer une nouvelle assignation: Créer une nouvelle assignation',
        );
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
