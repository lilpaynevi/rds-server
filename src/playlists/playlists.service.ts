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

/** Bornes acceptées pour une durée d'affichage, en millisecondes. */
const MIN_DISPLAY_DURATION = 1000;
const MAX_DISPLAY_DURATION = 600_000;

/**
 * Durée d'affichage demandée par le client, en millisecondes.
 *
 * Renvoie `null` dès que la valeur est absente ou hors bornes, auquel cas
 * l'appelant retombe sur la durée par défaut du type. Les bornes sont les mêmes
 * que celles de `changeDurationMedia` : sans elles, une erreur d'unité côté
 * client (secondes envoyées comme des millisecondes) pouvait enregistrer
 * plusieurs heures d'affichage pour une seule image.
 */
function pickDuration(raw: any): number | null {
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_DISPLAY_DURATION || value > MAX_DISPLAY_DURATION) return null;
  return value;
}

/**
 * Désérialise un tableau JSON parallèle à la liste des fichiers (dimensions,
 * durées…). Le multipart ne transporte que du texte : ces champs arrivent
 * sérialisés, ou pas du tout si l'app est d'une version antérieure — auquel cas
 * un tableau vide fait retomber chaque média sur ses valeurs par défaut.
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
/**
 * Options des transactions qui écrivent des fichiers sur le disque.
 *
 * `create`, `createMultiple` et `update` déplacent les fichiers tampon de multer
 * À L'INTÉRIEUR de la transaction interactive. Or Prisma coupe une transaction
 * interactive au bout de 5 s par défaut (`timeout`) et refuse d'en ouvrir une
 * après 2 s d'attente (`maxWait`) : dès qu'un envoi dépasse ces quelques
 * secondes — une seule vidéo suffit, et le dashboard en accepte 20 d'un coup —
 * la transaction est fermée d'office et tout l'appel échoue en P2028
 * (« Transaction already closed »), après avoir écrit les fichiers sur le
 * disque. Ces bornes larges rendent l'échec improbable ; le vrai correctif
 * (sortir les I/O disque de la transaction) est une refonte de ces trois
 * méthodes, hors du périmètre de cette vérification.
 */
const UPLOAD_TRANSACTION_OPTIONS = {
  maxWait: 30_000, // 30 s pour obtenir une connexion du pool
  timeout: 600_000, // 10 min, aligné sur le timeout HTTP côté client (0 = illimité)
};

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

      // 4️⃣ bis — « Activer immédiatement » : entrer dans la FILE D'ATTENTE.
      //
      // C'est elle, et elle seule, que la TV déroule. Une playlist créée
      // « active » n'y était jamais inscrite : le drapeau `isActive` était bien
      // posé sur la playlist, mais rien ne la diffusait. `changeActivePlaylist`
      // (l'interrupteur de l'app) crée bien cette entrée — la création, non.
      if (parsedData.isActive === true) {
        const last = await tx.playlistQueueItem.findFirst({
          where: { televisionId: parsedData.television },
          orderBy: { position: 'desc' },
        });

        await tx.playlistQueueItem.create({
          data: {
            playlistId: playlist.id,
            televisionId: parsedData.television,
            userId: user.sub,
            position: (last?.position ?? -1) + 1,
          },
        });

        console.log('✅ Playlist ajoutée à la file de diffusion');
      }

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
    }, UPLOAD_TRANSACTION_OPTIONS).then(async (result) => {
      // Notification APRÈS commit : avant, la TV rechargerait sa file sans y
      // voir la nouvelle entrée.
      //
      // `tv-queue-updated` plutôt qu'une poussée directe : la TV redemande sa
      // file, que le serveur filtre déjà selon les fenêtres de diffusion. Une
      // playlist créée « active » ET programmée n'apparaîtra donc qu'à l'heure
      // dite, au lieu d'être forcée à l'écran immédiatement.
      if (parsedData.isActive === true) {
        this.websocket.notifyTV(parsedData.television, 'tv-queue-updated', {
          playlistId: result.playlist.id,
        });
      }
      return result;
    });
  }

  async createMultiple(createPlaylistDto: any, files?: Express.Multer.File[]) {
    console.log('🚀 ~ PlaylistsService ~ createMultiple ~ files:', files);
    console.log(
      '🚀 ~ PlaylistsService ~ createMultiple ~ createPlaylistDto:',
      createPlaylistDto,
    );

    var parsedData = JSON.parse(createPlaylistDto);

    return await this.prisma.$transaction(async (tx) => {
      // ✅ 1️⃣ VÉRIFIER que toutes les télévisions existent
      const requestedTelevisionIds = Array.isArray(parsedData.televisions)
        ? parsedData.televisions
        : [parsedData.television];

      // Sans normalisation, une charge utile sans `televisions` NI `television`
      // donnait `[undefined]` : le test de longueur passait, puis Prisma
      // explosait sur `id: { in: [undefined] }` (500 illisible). Les doublons,
      // eux, faussaient la comparaison de longueur ci-dessous et déclenchaient
      // un faux « télévisions introuvables ».
      const televisionIds: string[] = Array.from(
        new Set(
          requestedTelevisionIds.filter(
            (id: any) => typeof id === 'string' && id.length > 0,
          ),
        ),
      );

      if (televisionIds.length === 0) {
        throw new BadRequestException('Aucune télévision sélectionnée');
      }

      const televisions = await tx.television.findMany({
        where: {
          id: { in: televisionIds },
        },
      });

      if (televisions.length !== televisionIds.length) {
        // `new Error` sortait en 500 « Internal server error » : le message
        // français n'atteignait jamais le dashboard, qui lit
        // `error.response.data.message`.
        throw new BadRequestException(
          "Certaines télévisions sont introuvables ou vous n'y avez pas accès",
        );
      }

      console.log(`✅ ${televisions.length} télévision(s) trouvée(s)`);

      // `Television.userId` est nullable en base alors que `Playlist.userId` et
      // `Media.userId` sont obligatoires : un écran rattaché à aucun compte
      // faisait avorter la transaction sur une erreur Prisma illisible.
      const orphanTelevision = televisions.find(
        (television) => !television.userId,
      );

      if (orphanTelevision) {
        throw new BadRequestException(
          `L'écran « ${orphanTelevision.name} » n'est rattaché à aucun compte : impossible d'y créer une playlist`,
        );
      }

      // Propriétaire des fichiers déposés : celui du PREMIER écran demandé
      // (ordre du client — `findMany` n'en garantit aucun). Avec un seul écran,
      // c'est exactement l'ancien comportement.
      const ownerUserId =
        televisions.find((television) => television.id === televisionIds[0])
          ?.userId ?? televisions[0].userId;

      /**
       * ✅ 2️⃣ CRÉER LES MÉDIAS — UNE SEULE FOIS, HORS DE LA BOUCLE D'ÉCRANS.
       *
       * Multer n'écrit qu'UN fichier tampon par upload et `persistUploadedFile`
       * le DÉPLACE : repasser sur le même `file` à l'écran suivant échoue en
       * ENOENT et fait avorter toute la transaction (et dupliquerait au passage
       * les médias et leurs `order` : 1,2,3,1,2,3). Un fichier = un `Media`,
       * partagé entre les playlists par leurs `PlaylistItem` — NE PAS
       * réimbriquer cette boucle dans celle des écrans « pour simplifier ».
       */
      const uploadedFiles = files ?? [];
      const createdMedias = [];

      // Emplacement volontairement indépendant de l'écran, puisque le fichier
      // est partagé par toutes les playlists créées ici. Le préfixe reste
      // `/uploads/media/...`, seule arborescence servie par UploadsController.
      const uploadDir = join(process.cwd(), 'uploads', 'media', ownerUserId);

      if (uploadedFiles.length > 0 && !existsSync(uploadDir)) {
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

      /**
       * `type` arrive tel quel du client ('image', 'video', 'pdf'…) et partait
       * en base via un simple `toUpperCase()`. Or l'enum Prisma `MediaType` ne
       * connaît que IMAGE|VIDEO|AUDIO|DOCUMENT : un PDF produisait la valeur
       * 'PDF', rejetée par Prisma AU MILIEU de la transaction — donc après le
       * déplacement des fichiers, qui restaient orphelins sur le disque.
       * Correspondance alignée sur `update()` (pdf → IMAGE) ; le vrai type reste
       * porté par `mimeType` ('application/pdf').
       */
      const getMediaType = (
        type,
        extension,
      ): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' => {
        // Type de retour explicite : sans lui TS élargit les littéraux en
        // `string`, non assignable à l'enum `MediaType` attendu par Prisma.
        switch (String(type || '').toLowerCase()) {
          case 'video':
            return 'VIDEO';
          case 'audio':
            return 'AUDIO';
          case 'document':
            return 'DOCUMENT';
          case 'image':
          case 'pdf':
            return 'IMAGE';
          default:
            // Type inconnu : on se rabat sur l'extension plutôt que d'envoyer
            // une valeur d'enum invalide.
            switch (extension) {
              case 'mp4':
              case 'mov':
              case 'webm':
              case 'avi':
              case 'mkv':
                return 'VIDEO';
              default:
                return 'IMAGE';
            }
        }
      };

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const item = parsedData.items?.[i];

        if (!file) continue;

        // Sans description associée, `item.name.split(...)` levait un TypeError
        // au milieu de la transaction : message exploitable à la place.
        if (!item) {
          throw new BadRequestException(
            `Aucune information fournie pour le fichier n°${i + 1} (champ « items »)`,
          );
        }

        const originalName = item.name || file.originalname || 'media';
        const itemType = item.type || 'image';

        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const extension = getFileExtension(originalName, file.mimetype);
        const uniqueFileName = `${timestamp}_${randomId}.${extension}`;
        const filePath = join(uploadDir, uniqueFileName);

        console.log('📁 Traitement fichier:', {
          original: originalName,
          mimetype: file.mimetype,
          extension: extension,
          unique: uniqueFileName,
        });

        // Déplace le fichier tampon écrit par multer (pas de buffer en mémoire)
        await persistUploadedFile(file, filePath);

        const { width, height } = pickDimensions(item);

        const media = await tx.media.create({
          data: {
            title: originalName.split('.')[0],
            filename: uniqueFileName,
            originalName: originalName,
            s3Key: uniqueFileName,
            s3Url: `/uploads/media/${ownerUserId}/${uniqueFileName}`,
            mimeType: getMimeType(itemType, extension),
            fileSize: file.size,
            width,
            height,
            type: getMediaType(itemType, extension),
            duration: item.duration ? Math.round(item.duration * 1000) : null,
            userId: ownerUserId,
            status: 'ACTIVE',
          },
        });

        createdMedias.push({
          media,
          // Copie normalisée : la suite lit `type` (durée par défaut) et
          // `duration` (total), qui doivent rester exploitables.
          originalItem: { ...item, name: originalName, type: itemType },
          order: i + 1,
        });
      }

      console.log(`✅ ${createdMedias.length} média(s) créé(s)`);

      // ✅ 3️⃣ CRÉER UNE PLAYLIST PAR TÉLÉVISION, sur ces mêmes médias
      const results = [];

      for (const television of televisions) {
        console.log(`🔄 Création playlist pour TV: ${television.name}`);

        // Créer la playlist
        const playlist = await tx.playlist.create({
          data: {
            name: `${parsedData.titre} - ${television.name}`,
            description: `Playlist avec ${createdMedias.length} médias pour ${television.name}`,
            isActive: parsedData.isActive,
            shuffleMode: false,
            repeatMode: 'LOOP',
            userId: television.userId,
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
              // Mêmes replis que dans `create()` : `startTime`/`endTime` sont
              // obligatoires en base (Schedule.startTime/endTime: String). Sans
              // eux, une charge utile qui précise les jours mais pas les heures
              // faisait échouer la transaction ENTIÈRE — après le déplacement
              // des fichiers, donc en laissant des orphelins sur le disque.
              startTime: parsedData.schedule.startTime || '00:00',
              endTime: parsedData.schedule.endTime || '23:59',
              daysOfWeek: parsedData.schedule.daysOfWeek,
              isActive: true,
              priority: 5,
              userId: television.userId,
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
    }, UPLOAD_TRANSACTION_OPTIONS);
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

    const result = await this.prisma.$transaction(async (tx) => {
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

      // Durées d'affichage choisies dans le formulaire, en millisecondes et dans
      // le même ordre. Un tableau vide (app antérieure) fait retomber chaque
      // média sur la durée par défaut de son type.
      const uploadedDurations: any[] = parseDimensions(parsedData.durations);

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

          // Durée d'affichage, en millisecondes : celle choisie dans le
          // formulaire d'abord, la valeur par défaut du type en secours.
          //
          // Cette méthode ignorait complètement la durée envoyée par le client
          // et imposait le défaut du type — d'où les 3 s enregistrées pour une
          // image alors que le formulaire affichait 10 s.
          const defaultDuration =
            pickDuration(uploadedDurations[i]) ?? getDefaultDuration(mediaType);

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
              // Reste null pour une vidéo : sa durée réelle vient du fichier,
              // pas d'un réglage d'affichage.
              duration: defaultDuration,
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
              // Même valeur que le média : les deux doivent concorder, sinon
              // l'app et l'écran affichent des durées différentes.
              duration: defaultDuration,
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
    }, UPLOAD_TRANSACTION_OPTIONS);

    // Les écrans ne rechargent leur file que sur événement. Sans cette
    // notification, des médias ajoutés ici n'apparaissaient qu'à la prochaine
    // reconnexion de la TV (le dashboard, lui, n'a aucun moyen d'émettre : il
    // n'y a pas de client socket côté serveur pour lui).
    if (files?.length) {
      const televisionIds = await this.televisionIdsForPlaylist(playlistId);
      televisionIds.forEach((televisionId) =>
        this.websocket.notifyTV(televisionId, 'tv-queue-updated', {
          playlistId,
        }),
      );
    }

    return result;
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
          // `id` et `order` sont indispensables au réordonnancement du
          // dashboard : sans `order` (et sans `orderBy`), les items remontaient
          // dans un ordre arbitraire, et « Enregistrer l'ordre » écrivait donc
          // cet ordre arbitraire. `title`/`originalName`/`type` évitent au
          // client de deviner l'intitulé depuis un nom de fichier généré.
          select: {
            id: true,
            order: true,
            orientation: true,
            // Durée propre à cette playlist : c'est elle que l'écran applique
            // en priorité (`item.duration ?? item.media.duration`). Elle était
            // absente de ce select, donc les clients ne voyaient que la durée
            // globale du média et affichaient autre chose que la diffusion.
            duration: true,
            rotation: true,
            media: {
              select: {
                id: true,
                title: true,
                originalName: true,
                filename: true,
                type: true,
                mimeType: true,
                s3Url: true,
                duration: true,
                width: true,
                height: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        schedules: true,
      },
    });
  }

  async removePlaylist(id: string) {
    // Même garde-fou que removeMedia : un `deleteMany` sans filtre effectif
    // (id undefined) supprimerait toutes les playlists de la base.
    if (!id) {
      throw new BadRequestException('Identifiant de playlist requis');
    }

    return this.prisma.playlist.deleteMany({
      where: {
        id,
      },
    });
  }

  async removeMedia(id: string) {
    console.log('🚀 ~ PlaylistsService ~ removeMedia ~ id:', id);

    // Garde-fou : avec un id absent, `deleteMany({ where: { id: undefined } })`
    // ne filtre RIEN et viderait toute la table medias. Le `if (id)` d'origine
    // protégeait la lecture du fichier, pas la suppression.
    if (!id) {
      throw new BadRequestException('Identifiant de média requis');
    }

    // Relevé AVANT la suppression : la cascade sur PlaylistItem efface le lien
    // média ↔ playlist, on ne saurait plus qui prévenir après coup.
    const impactedItems = await this.prisma.playlistItem.findMany({
      where: { mediaId: id },
      select: { playlistId: true },
    });

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

      // Média inexistant : `findUrlMedia.s3Url` levait un TypeError → 500
      // illisible pour le client. 404 explicite à la place.
      if (!findUrlMedia) {
        throw new NotFoundException('Média introuvable');
      }

      // Le fichier peut déjà avoir disparu du disque (nettoyage manuel, volume
      // recréé…). Sans ce filet, ENOENT faisait échouer tout l'appel et la
      // ligne en base devenait IMPOSSIBLE à supprimer : le média restait
      // indéfiniment dans la playlist avec un fichier absent.
      if (findUrlMedia.s3Url) {
        const uploadDir = join(process.cwd(), findUrlMedia.s3Url);
        try {
          await unlink(uploadDir);
        } catch (error) {
          console.warn(
            `⚠️ Fichier média introuvable sur le disque, suppression en base malgré tout: ${uploadDir}`,
            error?.code ?? error,
          );
        }
      }
    }

    const result = await this.prisma.media.deleteMany({
      where: {
        id,
      },
    });

    // Sans notification, la TV continuait de jouer un média dont le fichier
    // vient d'être effacé (case vide ou erreur de lecture) jusqu'à sa prochaine
    // reconnexion. Un seul événement par écran, même si le média appartenait à
    // plusieurs playlists diffusées dessus.
    const notified = new Set<string>();
    const playlistIds = Array.from(
      new Set(impactedItems.map((item) => item.playlistId)),
    );

    for (const playlistId of playlistIds) {
      const televisionIds = await this.televisionIdsForPlaylist(playlistId);

      televisionIds.forEach((televisionId) => {
        if (notified.has(televisionId)) return;
        notified.add(televisionId);
        this.websocket.notifyTV(televisionId, 'tv-queue-updated', {
          playlistId,
        });
      });
    }

    return result;
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
        // `new Error` remontait en 500 « Internal server error » sans message
        // exploitable : le client ne pouvait pas expliquer l'échec à
        // l'utilisateur. Cas fonctionnel courant (playlist en file mais plus
        // assignée), donc 404 avec un message actionnable.
        throw new NotFoundException(
          "Cette playlist n'est pas assignée à cet écran : assignez-la d'abord à l'écran avant de modifier sa file d'attente",
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

      // La durée s'écrit sur le PlaylistItem, pas sur le Media.
      //
      // C'est la colonne que l'écran applique en priorité
      // (`item.duration ?? item.media.duration`), et le schéma le dit :
      // « Override media duration if needed ». Écrire `Media.duration` était
      // doublement faux : la valeur était ignorée à la diffusion, puisque
      // l'override de l'item l'emportait toujours, et elle s'appliquait à
      // toutes les playlists contenant ce fichier au lieu de celle-ci seule.
      const updatedItem = await this.prisma.playlistItem.update({
        where: { id: playlistMedia.id },
        data: { duration: data.duration },
      });

      // Mettre à jour le timestamp de la playlist
      await this.prisma.playlist.update({
        where: { id: playlistId },
        data: { updatedAt: new Date() },
      });

      // Sans notification, le changement n'atteignait l'écran qu'à sa prochaine
      // reconnexion. `tv-queue-updated` suffit : la TV recharge sa file et
      // applique la nouvelle durée sans interrompre la lecture en cours, la
      // liste des médias étant inchangée.
      const televisionIds = await this.televisionIdsForPlaylist(playlistId);
      televisionIds.forEach((televisionId) =>
        this.websocket.notifyTV(televisionId, 'tv-queue-updated', {
          playlistId,
        }),
      );

      return {
        success: true,
        message: 'Durée mise à jour avec succès',
        data: updatedItem,
      };
    } catch (error) {
      console.error('Erreur changeDurationMedia:', error);
      throw error;
    }
  }

  /**
   * Écrans à prévenir pour une playlist : ceux auxquels elle est assignée *et*
   * ceux qui l'ont dans leur file d'attente. Une playlist peut être diffusée
   * par l'un ou l'autre chemin, et `PlaylistTelevision.televisionId` est
   * nullable — les lignes sans écran sont donc écartées.
   */
  private async televisionIdsForPlaylist(
    playlistId: string,
  ): Promise<string[]> {
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

    return Array.from(
      new Set(
        [...assignments, ...queueEntries]
          .map((entry) => entry.televisionId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
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
    const televisionIds = await this.televisionIdsForPlaylist(playlistId);

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

  /**
   * Rotation manuelle d'un média, en degrés, propre à cette playlist.
   *
   * Portée par le PlaylistItem comme l'orientation : le même fichier peut être
   * pivoté différemment d'une playlist à l'autre.
   */
  async changeRotationMedia(
    playlistId: string,
    mediaId: string,
    data: { rotation: number },
  ) {
    const ALLOWED = [0, 90, 180, 270];
    // Normalise avant de valider : une accumulation côté client (+90 répété)
    // peut dépasser 360, et 360 doit valoir 0.
    const rotation = ((Math.round(Number(data?.rotation)) % 360) + 360) % 360;

    if (!Number.isFinite(rotation) || !ALLOWED.includes(rotation)) {
      throw new BadRequestException(
        `Rotation invalide. Valeurs acceptées : ${ALLOWED.join(', ')} degrés`,
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
      data: { rotation },
    });

    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { updatedAt: new Date() },
    });

    // Même canal que l'orientation : la TV applique la rotation au média en
    // cours sans recharger la playlist ni repartir du premier média.
    const televisionIds = await this.televisionIdsForPlaylist(playlistId);
    televisionIds.forEach((televisionId) =>
      this.websocket.notifyTV(televisionId, 'tv-media-rotation-updated', {
        playlistId,
        mediaId,
        rotation,
      }),
    );

    return {
      success: true,
      message: 'Rotation mise à jour avec succès',
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

  /**
   * Remplace d'un bloc la liste des écrans d'une playlist : le client envoie
   * l'état final voulu, pas un delta. Les assignations déjà en place sont
   * laissées intactes (on ne réécrit ni `isActive` ni `priority` : les régler
   * reste le rôle de changeActivePlaylist).
   */
  async setPlaylistTelevisions(
    playlistId: string,
    televisionIds: string[],
    user: any,
  ) {
    if (!Array.isArray(televisionIds)) {
      throw new BadRequestException(
        "Le champ televisionIds doit être un tableau d'identifiants d'écrans",
      );
    }

    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true, name: true },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist introuvable');
    }

    // Dédoublonnage : deux fois le même écran violerait la contrainte
    // @@unique([playlistId, televisionId]).
    const requested = Array.from(
      new Set(
        televisionIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    );

    // Un identifiant d'écran inconnu remonterait en violation de clé étrangère
    // (500) : on le refuse en amont avec un message lisible.
    if (requested.length > 0) {
      const knownTelevisions = await this.prisma.television.findMany({
        where: { id: { in: requested } },
        select: { id: true },
      });

      if (knownTelevisions.length !== requested.length) {
        const known = new Set(knownTelevisions.map((tv) => tv.id));
        const unknown = requested.filter((id) => !known.has(id));
        throw new NotFoundException(
          `Écran(s) introuvable(s) : ${unknown.join(', ')}`,
        );
      }
    }

    const currentAssignments = await this.prisma.playlistTelevision.findMany({
      where: { playlistId },
      select: { televisionId: true },
    });

    const currentIds = currentAssignments
      .map((assignment) => assignment.televisionId)
      .filter((id): id is string => Boolean(id));

    const toCreate = requested.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !requested.includes(id));

    await this.prisma.$transaction(async (tx) => {
      if (toCreate.length > 0) {
        await tx.playlistTelevision.createMany({
          data: toCreate.map((televisionId) => ({
            playlistId,
            televisionId,
            isActive: true,
            priority: 5,
          })),
          skipDuplicates: true,
        });
      }

      if (toRemove.length > 0) {
        await tx.playlistTelevision.deleteMany({
          where: { playlistId, televisionId: { in: toRemove } },
        });

        // Sans ça, la playlist continuerait de tourner dans la file d'attente
        // de l'écran qu'on vient justement de lui retirer.
        await tx.playlistQueueItem.deleteMany({
          where: { playlistId, televisionId: { in: toRemove } },
        });
      }
    });

    // Chaque écran retiré doit recharger sa file : la playlist n'y est plus.
    toRemove.forEach((televisionId) =>
      this.websocket.notifyTV(televisionId, 'tv-queue-updated', {}),
    );

    const assignments = await this.prisma.playlistTelevision.findMany({
      where: { playlistId },
      select: {
        id: true,
        isActive: true,
        priority: true,
        assignedAt: true,
        televisionId: true,
        television: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(
      `🖥️ Écrans de la playlist ${playlistId} mis à jour par ${user?.sub} : +${toCreate.length} / -${toRemove.length}`,
    );

    return {
      success: true,
      message: `${assignments.length} écran(s) assigné(s) à la playlist`,
      televisionIds: assignments
        .map((assignment) => assignment.televisionId)
        .filter((id): id is string => Boolean(id)),
      televisions: assignments,
      changes: {
        added: toCreate,
        removed: toRemove,
      },
    };
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

  /**
   * Réordonne les médias d'une playlist à partir de la liste complète
   * [{ mediaId, order }] envoyée par le client.
   *
   * `playlistId` est optionnel pour ne pas casser les appels existants, mais il
   * devrait toujours être fourni : sans lui, l'ordre est réécrit dans TOUTES
   * les playlists contenant le média (un même fichier peut être partagé entre
   * plusieurs playlists) et aucune TV ne peut être notifiée.
   */
  async reorderPlaylistToTV(
    data: { mediaId: string; order: number }[],
    playlistId?: string,
  ) {
    console.log('🚀 ~ PlaylistsService ~ reorderPlaylistToTV ~ data:', data);

    if (!Array.isArray(data) || data.length === 0) {
      throw new BadRequestException(
        'Le nouvel ordre doit être un tableau non vide de { mediaId, order }',
      );
    }

    const entries = data.map((item) => ({
      mediaId: item?.mediaId,
      order: Math.round(Number(item?.order)),
    }));

    const invalidEntry = entries.find(
      (entry) => !entry.mediaId || !Number.isFinite(entry.order),
    );

    if (invalidEntry) {
      throw new BadRequestException(
        'Chaque entrée doit contenir un mediaId et un order numérique',
      );
    }

    if (playlistId) {
      const playlist = await this.prisma.playlist.findUnique({
        where: { id: playlistId },
        select: { id: true },
      });

      if (!playlist) {
        throw new NotFoundException('Playlist introuvable');
      }
    }

    const results = await this.prisma.$transaction(async (prisma) => {
      const updateResults = [];

      // Séquentiel et non Promise.all : une transaction interactive Prisma ne
      // supporte pas les requêtes concurrentes sur le même client.
      for (const entry of entries) {
        const updateResult = await prisma.playlistItem.updateMany({
          where: {
            mediaId: entry.mediaId,
            ...(playlistId ? { playlistId } : {}),
          },
          data: {
            order: entry.order,
          },
        });

        console.log(
          `📝 Mise à jour item ${entry.mediaId}: ${updateResult.count} enregistrement(s) modifié(s)`,
        );

        updateResults.push({
          mediaId: entry.mediaId,
          newOrder: entry.order,
          updated: updateResult.count > 0,
          affectedRows: updateResult.count,
        });
      }

      return updateResults;
    });

    let notifiedTelevisions: string[] = [];

    if (playlistId) {
      await this.prisma.playlist.update({
        where: { id: playlistId },
        data: { updatedAt: new Date() },
      });

      // Même événement que les autres changements de file : la TV rappelle
      // "tv-get-playlist-queue", dont les items sont déjà triés par `order`.
      notifiedTelevisions = await this.televisionIdsForPlaylist(playlistId);
      notifiedTelevisions.forEach((televisionId) =>
        this.websocket.notifyTV(televisionId, 'tv-queue-updated', {
          playlistId,
        }),
      );
    }

    return {
      success: true,
      message: 'Ordre des médias mis à jour avec succès',
      data: results,
      notifiedTelevisions,
    };
  }
}
