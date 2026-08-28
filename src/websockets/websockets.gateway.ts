import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebsocketsService } from './websockets.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { canPlayNow, isScheduleOpen } from 'src/common/schedule.util';

interface ConnectedDevice {
  deviceId: string;
  socketId: string;
  connectedAt: Date;
}

// 🎞️ État de lecture courant remonté par une TV.
// Tous les champs hors tvId sont optionnels : la TV peut n'envoyer qu'une partie
// de l'information selon ce qu'elle connaît au moment du changement de média.
interface NowPlayingState {
  tvId: string;
  mediaId?: string;
  mediaTitle?: string;
  playlistId?: string;
  playlistName?: string;
  index?: number;
  total?: number;
  receivedAt: string;
}

@WebSocketGateway({
  namespace: 'tv',
  cors: { origin: '*' },
})
export class WebsocketsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketsGateway.name);

  private connectedDevices = new Map<string, ConnectedDevice>();

  // 🎞️ Média en cours de lecture, par TV (clé = tvId).
  // Volontairement en mémoire et non en base : cet état est volatil et de forte
  // fréquence (il change à chaque média, donc potentiellement toutes les quelques
  // secondes). L'écrire en base à chaque changement n'aurait aucun intérêt — la
  // donnée est périmée dès l'écriture suivante et n'a de valeur que pour le
  // dashboard connecté à l'instant présent.
  private nowPlaying = new Map<string, NowPlayingState>();

  constructor(
    private readonly websocketsService: WebsocketsService,
    private prisma: PrismaService,
  ) {}

  // 🚀 Lifecycle Hooks
  afterInit(server: Server) {
    this.logger.log('🌐 WebSocket Gateway TV initialisé');
  }

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client déconnecté: ${client.id}`);

    // Nettoie les devices connectés
    for (const [deviceId, device] of this.connectedDevices.entries()) {
      if (device.socketId === client.id) {
        this.connectedDevices.delete(deviceId);
        this.logger.log(`📺 Device ${deviceId} supprimé`);

        // 🎞️ Purge l'état de lecture : sans ça le dashboard continuerait
        // d'afficher indéfiniment le dernier média d'une TV éteinte.
        if (this.nowPlaying.delete(deviceId)) {
          this.logger.log(`🎞️ État de lecture purgé - TV: ${deviceId}`);
          // On informe les observateurs restants de la room (le dashboard) que
          // la TV ne diffuse plus rien.
          this.notifyTV(deviceId, 'tv-now-playing-cleared', {
            tvId: deviceId,
            reason: 'disconnect',
          });
        }
        break;
      }
    }
  }

  // 📺 Connexion TV
  @SubscribeMessage('connect-tv-code')
  async handleTVConnectionWithCode(
    @MessageBody() data: { code: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('🚀 ~ WebsocketsGateway ~ handleTVConnection ~ data:', data);
    try {
      if (!data?.code) {
        this.logger.error(`❌ code manquant`);
        return {
          event: 'error',
          message: 'code requis',
        };
      }

      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: data.userId,
        },
        include: {
          Subscription: {
            select: {
              currentMaxScreens: true,
              usedScreens: true,
              id: true,
              plan: true,
            },
          },
          televisions: true,
        },
      });

      const subscription = existingUser.Subscription.find(
        (it) => it.plan.planType === 'MAIN',
      );

      const userMaxScreen =
        existingUser &&
        existingUser.Subscription &&
        subscription.currentMaxScreens;

      const userNumberTVAssocited = existingUser && subscription.usedScreens;

      const existingCode = await this.prisma.television.findFirst({
        where: {
          codeConnection: data.code,
        },
      });

      if (existingUser && !userMaxScreen) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: 'Vous devez avoir un abonnement pour ajouter une TV',
        });

        return 'Vous devez avoir un abonnement pour ajouter une TV';
      }

      if (!existingCode) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: 'Code de connexion invalide',
        });
        return 'pas de code existant';
      }

      if (existingUser && userNumberTVAssocited >= userMaxScreen) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: `Vous avez déjà dépassé votre capacité d'écran pour votre abonnement ! Merci d'augmenter votre capacité d'écran`,
        });

        return `Vous avez déjà dépassé votre capacité d'écran pour votre abonnement ! Merci d'augmenter votre capacité d'écran`;
      }

      if (existingCode && existingCode.userId !== null) {
        console.log(
          '🚀 ~ WebsocketsGateway ~ handleTVConnectionWithCode ~ TV already associated to userId:',
          existingCode.userId,
        );
        client.emit('connect-tv-code-error', {
          status: false,
          error: 'TV dejà associé',
        });
        return 'TV dejà associé';
      }

      if (existingCode.id && data.userId && data.code) {
        await client.join(`tv:${existingCode.id}`);
        console.log(
          '🚀 ~ WebsocketsGateway ~ handleTVConnectionWithCode ~ `tv:${existingCode.id}`:',
          `tv:${existingCode.id}`,
        );

        await this.prisma.subscription.updateMany({
          data: {
            usedScreens: subscription.usedScreens + 1,
          },
          where: {
            id: subscription.id,
          },
        });

        await this.prisma.television.updateMany({
          data: {
            userId: data.userId,
          },
          where: {
            id: existingCode.id,
          },
        });
      }

      const user = await this.prisma.user.findUnique({
        where: {
          id: data.userId,
        },
      });

      // Stocke les infos du device
      const deviceInfo: ConnectedDevice = {
        deviceId: existingCode.id,
        socketId: client.id,
        connectedAt: new Date(),
      };

      this.connectedDevices.set(existingCode.id, deviceInfo);

      this.logger.log(`📺 TV connectée à ${data.userId}: ${existingCode}`);

      client.emit('connect-tv-code-success', {
        message: 'TV connectée avec succès',
        deviceId: existingCode.id,
        tvName: existingCode.name,
        socketId: client.id,
      });

      await this.notifyTV(existingCode.id, 'code-used', {
        status: `l user ${data.userId} s'est connecté à la room `,
        userId: data.userId,
        userName: user ? user.firstName + ' ' + user.lastName : ' à vous !',
      });

      return;
    } catch (error) {
      this.logger.error(`❌ Erreur connexion TV: ${error.message}`);
      return {
        event: 'error',
        message: 'Erreur lors de la connexion',
      };
    }
  }

  @SubscribeMessage('connect-tv')
  async handleTVConnection(
    @MessageBody() data: { deviceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('🚀 ~ WebsocketsGateway ~ handleTVConnection ~ data:', data);
    try {
      if (!data?.deviceId) {
        this.logger.error(`❌ DeviceId manquant`);
        return {
          event: 'error',
          message: 'DeviceId requis',
        };
      }

      // Rejoint la room du device
      await client.join(`tv:${data.deviceId}`);

      // Stocke les infos du device
      const deviceInfo: ConnectedDevice = {
        deviceId: data.deviceId,
        socketId: client.id,
        connectedAt: new Date(),
      };

      this.connectedDevices.set(data.deviceId, deviceInfo);

      this.logger.log(`📺 TV connectée - Device: ${data.deviceId}`);

      return {
        event: 'connected',
        data: {
          message: 'TV connectée avec succès',
          deviceId: data.deviceId,
          socketId: client.id,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur connexion TV: ${error.message}`);
      return {
        event: 'error',
        message: 'Erreur lors de la connexion',
      };
    }
  }

  // 🎬 Changer le contenu affiché
  @SubscribeMessage('change-content')
  handleContentChange(
    @MessageBody()
    data: {
      deviceId: string;
      contentType: any;
      title: any;
      content: string;
    },
  ) {
    try {
      if (!data?.deviceId || !data?.content) {
        return {
          event: 'error',
          message: 'DeviceId et content requis',
        };
      }

      this.logger.log(
        `🎬 Changement contenu - Device: ${data.deviceId}, Type: ${data.contentType}`,
      );

      // Notifie la TV spécifique
      this.notifyTV(data.deviceId, 'content-changed', {
        contentType: data.contentType || 'url',
        content: data.content,
        title: data.title,
        timestamp: new Date().toISOString(),
      });

      return {
        event: 'content-change-sent',
        data: {
          deviceId: data.deviceId,
          contentType: data.contentType,
          content: data.content,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur changement contenu: ${error.message}`);
      return {
        event: 'error',
        message: 'Erreur lors du changement de contenu',
      };
    }
  }

  // 📊 Statut de la TV
  @SubscribeMessage('tv-status')
  async handleTVStatus(@MessageBody() data: { deviceId: string }) {
    try {
      if (!data?.deviceId) {
        return {
          event: 'error',
          message: 'DeviceId requis',
        };
      }

      const room = `device:${data.deviceId}`;
      const sockets = await this.server.in(room).fetchSockets();
      const deviceInfo = this.connectedDevices.get(data.deviceId);

      return {
        event: 'status-response',
        data: {
          deviceId: data.deviceId,
          isConnected: sockets.length > 0,
          connectedAt: deviceInfo?.connectedAt || null,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur statut TV: ${error.message}`);
      return {
        event: 'error',
        message: 'Erreur lors de la récupération du statut',
      };
    }
  }

  // 🎬 Déclenche la lecture d'une playlist sur une TV (appel server-side)
  async changePlaylistForTV(tvId: string, playlistId: string): Promise<void> {
    try {
      const playlist = await this.prisma.playlist.findUnique({
        where: { id: playlistId },
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
          schedules: {
            where: {
              isActive: true,
              OR: [{ televisionId: tvId }, { televisionId: null }],
            },
          },
        },
      });

      if (!playlist) {
        this.logger.warn(
          `⚠️ changePlaylistForTV: playlist ${playlistId} introuvable`,
        );
        return;
      }

      // Une playlist programmée ne s'affiche que dans sa fenêtre, même créée
      // « active » : sans ce garde-fou, la création la poussait immédiatement
      // à l'écran, hors horaires.
      if (!canPlayNow(playlist.schedules)) {
        this.logger.log(
          `⏭️ changePlaylistForTV: "${playlist.name}" hors de sa fenêtre, non poussée`,
        );
        return;
      }

      const playlistItems = playlist.items.map((item) => ({
        uri: item.media.s3Url,
        duration: item.media.duration,
        mediaId: item.mediaId,
        order: item.order,
        orientation: item.orientation,
        rotation: item.rotation,
        width: item.media.width,
        height: item.media.height,
      }));

      this.notifyTV(tvId, 'tv-change-playlist-success', {
        message: `tv-change-playlist-success tv:${tvId}`,
        playlistId: playlist.id,
        playlistName: playlist.name,
        items: playlistItems,
      });
    } catch (error) {
      this.logger.error(`❌ changePlaylistForTV: ${error.message}`);
    }
  }

  // 🔄 Méthode helper pour notifier une TV spécifique
  notifyTV(deviceId: string, event: string, data: any): boolean {
    try {
      this.server.to(`tv:${deviceId}`).emit(event, data);
      console.log('🚀 ~ WebsocketsGateway ~ notifyTV ~ deviceId:', deviceId);
      console.log('🚀 ~ WebsocketsGateway ~ notifyTV ~ data:', data);
      this.logger.log(
        `📤 Notification envoyée - Device: ${deviceId}, Event: ${event}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Erreur notification - Device: ${deviceId}: ${error.message}`,
      );
      return false;
    }
  }

  // 📋 Liste des devices connectés
  @SubscribeMessage('list-devices')
  handleListDevices() {
    const devices = Array.from(this.connectedDevices.values());

    this.logger.log(`📋 ${devices.length} devices connectés`);

    return {
      event: 'devices-list',
      data: {
        devices: devices.map((d) => ({
          deviceId: d.deviceId,
          connectedAt: d.connectedAt,
        })),
        count: devices.length,
      },
    };
  }

  @SubscribeMessage('list-rooms')
  handleListRooms(@ConnectedSocket() client: Socket) {
    try {
      if (!this.server) {
        return { event: 'error', message: 'Server non initialisé' };
      }

      const rooms = Array.from(client.rooms.entries());
      console.log('🚀 ~ WebsocketsGateway ~ handleListRooms ~ rooms:', rooms);

      return {
        event: 'rooms-list',
        data: rooms.map(([name, sockets]) => ({
          name,
          count: sockets.length,
        })),
      };
    } catch (error) {
      this.logger.error('❌ Erreur:', error);
      return { event: 'error', message: 'Erreur' };
    }
  }

  // 🏠 Infos détaillées d'une room spécifique
  @SubscribeMessage('room-info')
  handleRoomInfo(
    @MessageBody() data: { roomName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomName } = data;

      if (!roomName) {
        return { event: 'error', message: 'Nom de room requis' };
      }

      const room = this.server.sockets.adapter.rooms.get(roomName);

      if (!room) {
        return {
          event: 'room-info-response',
          data: {
            roomName,
            exists: false,
            message: 'Room non trouvée',
          },
        };
      }

      // Récupère les infos des clients dans cette room
      const clientsInfo = [];
      for (const socketId of room) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          clientsInfo.push({
            socketId: socketId,
            connected: socket.connected,
            connectedAt: socket.handshake.time,
            address: socket.handshake.address,
          });
        }
      }

      this.logger.log(`🏠 Info room ${roomName} - ${room.size} clients`);

      return {
        event: 'room-info-response',
        data: {
          roomName,
          exists: true,
          clientCount: room.size,
          clients: clientsInfo,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur room info:`, error);
      return {
        event: 'error',
        message: 'Erreur lors de la récupération des infos de room',
      };
    }
  }

  // 🏠 Statistiques globales du serveur
  @SubscribeMessage('server-stats')
  handleServerStats() {
    try {
      const totalClients = this.server.engine.clientsCount;
      const rooms = this.server.sockets.adapter.rooms;
      const totalRooms = Array.from(rooms.entries()).filter(
        ([roomName, sockets]) => !sockets.has(roomName),
      ).length;

      const stats = {
        totalConnectedClients: totalClients,
        totalRooms: totalRooms,
        totalDevicesRegistered: this.connectedDevices.size,
        uptime: process.uptime(),
        timestamp: new Date(),
      };

      this.logger.log(`📊 Stats serveur demandées`);

      return {
        event: 'server-stats-response',
        data: stats,
      };
    } catch (error) {
      this.logger.error('❌ Erreur stats serveur:', error);
      return {
        event: 'error',
        message: 'Erreur lors de la récupération des stats',
      };
    }
  }

  // 🏠 Rejoindre une room custom
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { roomName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomName } = data;

      if (!roomName) {
        return { event: 'error', message: 'Nom de room requis' };
      }

      client.join(`tv:${roomName}`);

      this.logger.log(
        `🏠 Client ${client.id} a rejoint la room tv:${roomName}`,
      );

      // Notifie les autres clients de la room
      client.to(roomName).emit('user-joined-room', {
        socketId: client.id,
        roomName: roomName,
        timestamp: new Date(),
      });

      return {
        event: 'room-joined',
        data: {
          roomName,
          socketId: client.id,
          message: `Rejoint la room ${roomName} avec succès`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur join room:', error);
      return {
        event: 'error',
        message: 'Erreur lors de la connexion à la room',
      };
    }
  }

  // 🏠 Quitter une room
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: { tvId: string; roomName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomName, tvId } = data;
      console.log('🚀 ~ WebsocketsGateway ~ handleLeaveRoom ~ tvId:', tvId);

      if (!roomName) {
        return { event: 'error', message: 'Nom de room requis' };
      }

      this.logger.log(`🏠 Client ${client.id} a quitté la room ${roomName}`);

      // Notifie les autres clients de la room
      client.to(roomName).emit('user-left-room', {
        socketId: client.id,
        roomName: roomName,
        timestamp: new Date(),
      });

      await this.notifyTV(tvId, 'tv-dissociated', {
        message: `TV ${tvId} EST DISSOCIÉ`,
        tvId,
        sync: false,
      });

      client.leave(roomName);

      return {
        event: 'tv-dissociated',
        data: {
          roomName,
          socketId: client.id,
          message: `TV ${tvId} EST DISSOCIÉ`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur leave room:', error);
      return {
        event: 'error',
        message: 'Erreur lors de la déconnexion de la room',
      };
    }
  }

  // 🎯 CRUD WebSocket (tes méthodes existantes)
  @SubscribeMessage('tv-schedules-updated')
  handleSchedulesUpdated(@MessageBody() data: { tvId: string }) {
    if (data?.tvId) {
      this.notifyTV(data.tvId, 'tv-schedules-updated', {});
    }
  }

  @SubscribeMessage('tv-get-scheduled-playlists')
  async handleGetScheduledPlaylists(
    @MessageBody() data: { tvId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.tvId) {
      client.emit('tv-scheduled-playlists', { playlists: [] });
      return;
    }

    try {
      const schedules = await this.prisma.schedule.findMany({
        where: {
          isActive: true,
          playlistId: { not: null },
          // La playlist doit être ACTIVE sur cet écran.
          //
          // Sans cette condition, désactiver une playlist ne coupait pas sa
          // diffusion : `changeActivePlaylist` la retire de la file d'attente,
          // mais le planning restait valide et reste prioritaire sur la file —
          // la playlist continuait donc de s'afficher pendant sa fenêtre.
          //
          // C'est `PlaylistTelevision.isActive` qui fait foi, et non le drapeau
          // `Playlist.isActive`, global à toutes les TVs : la désactivation doit
          // valoir écran par écran.
          playlist: {
            televisions: {
              some: { televisionId: data.tvId, isActive: true },
            },
          },
          OR: [
            // Planning visant explicitement cet écran
            { televisionId: data.tvId },
            // Planning GLOBAL (aucun écran désigné) portant sur une playlist
            // assignée à cet écran.
            //
            // Le `televisionId: null` est indispensable : sans lui, un planning
            // créé pour l'écran A était aussi envoyé à l'écran B dès que la
            // playlist était assignée aux deux. B appliquait donc des horaires
            // qui ne le concernaient pas, et la programmation semblait « ne pas
            // être prise en compte » là où elle était attendue.
            // L'appartenance à cet écran est déjà vérifiée plus haut.
            { televisionId: null },
          ],
        },
        include: {
          playlist: {
            include: {
              items: {
                include: { media: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        // Sans tri explicite, PostgreSQL renvoie les lignes dans un ordre non
        // garanti, qui change après chaque mise à jour. La TV arbitre déjà de
        // façon déterministe, mais un ordre stable rend les journaux et le
        // diagnostic reproductibles.
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });

      const playlists = schedules
        .filter((s) => s.playlist)
        .map((schedule) => ({
          id: schedule.playlist.id,
          title: schedule.playlist.name,
          isActive: schedule.isActive,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          daysOfWeek: schedule.daysOfWeek,
          priority: schedule.priority,
          items: schedule.playlist.items.map((item) => ({
            uri: item.media.s3Url,
            duration: item.duration ?? item.media.duration,
            id: item.id,
            mediaId: item.mediaId,
            orientation: item.orientation,
            rotation: item.rotation,
            width: item.media.width,
            height: item.media.height,
            title: item.media.title,
          })),
        }));

      client.emit('tv-scheduled-playlists', { playlists });
    } catch (error) {
      this.logger.error(
        `❌ Erreur tv-get-scheduled-playlists: ${error.message}`,
      );
      client.emit('tv-scheduled-playlists', { playlists: [] });
    }
  }

  @SubscribeMessage('tv-get-playlist-queue')
  async handleGetPlaylistQueue(
    @MessageBody() data: { tvId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.tvId) {
      client.emit('tv-playlist-queue', { items: [] });
      return;
    }

    try {
      const queueItems = await this.prisma.playlistQueueItem.findMany({
        where: { televisionId: data.tvId },
        include: {
          playlist: {
            include: {
              items: {
                include: { media: true },
                orderBy: { order: 'asc' },
              },
              schedules: {
                where: {
                  isActive: true,
                  OR: [{ televisionId: data.tvId }, { televisionId: null }],
                },
              },
            },
          },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });

      const items = queueItems
        // Exclusivité de la programmation : une playlist qui en a une ne sort
        // JAMAIS par la file d'attente. Elle ne peut s'afficher que par son
        // planning, et donc uniquement dans sa fenêtre horaire.
        //
        // Sans ce filtre, le seul rempart était côté TV, où l'exclusion dépend
        // d'un planning correctement reçu ET encore dans sa plage de dates :
        // au moindre écart, la playlist repassait en diffusion continue.
        .filter((queueItem) => {
          const playable = canPlayNow(queueItem.playlist.schedules);
          if (!playable) {
            this.logger.log(
              `⏭️ "${queueItem.playlist.name}" hors de sa fenêtre, retirée de la file de ${data.tvId}`,
            );
          }
          return playable;
        })
        .map((queueItem) => ({
          id: queueItem.playlist.id,
          title: queueItem.playlist.name,
          items: queueItem.playlist.items.map((item) => ({
            uri: item.media.s3Url,
            duration: item.duration ?? item.media.duration,
            id: item.id,
            mediaId: item.mediaId,
            orientation: item.orientation,
            rotation: item.rotation,
            width: item.media.width,
            height: item.media.height,
            // Renseigne le « média en cours » que la TV remonte au dashboard
            title: item.media.title,
          })),
        }));

      client.emit('tv-playlist-queue', { items });
    } catch (error) {
      this.logger.error(`❌ Erreur tv-get-playlist-queue: ${error.message}`);
      client.emit('tv-playlist-queue', { items: [] });
    }
  }

  @SubscribeMessage('tv-find-playlist')
  async handleFindPlaylist(
    @MessageBody() data: { tvId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.tvId) {
      client.emit('tv-find-playlist-error', { message: 'Pas de TV indiqué' });
      return false;
    }

    try {
      // Récupère les playlists diffusables sur cette TV.
      //
      // L'assignation doit être ACTIVE (`isActive: true` sur la ligne
      // PlaylistTelevision) : sans cette condition, une playlist désactivée sur
      // cet écran continuait de sortir par ce repli tant que son drapeau global
      // `Playlist.isActive` restait vrai — c'est-à-dire dès qu'elle était encore
      // active sur un AUTRE écran. Aucune playlist active, aucune diffusion.
      const playlists = await this.prisma.playlist.findMany({
        where: {
          televisions: {
            some: { televisionId: data.tvId, isActive: true },
          },
          OR: [
            { isActive: true },
            {
              schedules: {
                some: {
                  isActive: true,
                  OR: [{ televisionId: data.tvId }, { televisionId: null }],
                },
              },
            },
          ],
        },
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
          schedules: {
            where: {
              isActive: true,
              OR: [{ televisionId: data.tvId }, { televisionId: null }],
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();

      const activePlaylist = playlists.find((playlist) => {
        const hasSchedule = playlist.schedules?.length > 0;

        // Playlist sans schedule → active seulement si isActive: true
        if (!hasSchedule) return playlist.isActive;

        // Playlist avec schedule → active seulement si la plage horaire est
        // respectée. Le test passe par `isScheduleOpen`, comme partout ailleurs.
        // La copie manuscrite qui vivait ici divergeait sur deux points : elle
        // ne gérait pas les fenêtres à cheval sur minuit (22:00 → 02:00, jamais
        // ouvertes), et elle fermait à `endTime` pile au lieu d'inclure cette
        // minute — deux réponses possibles pour la même question selon le
        // chemin emprunté.
        return playlist.schedules.some((schedule) =>
          isScheduleOpen(schedule, now),
        );
      });

      if (!activePlaylist) {
        client.emit('tv-find-playlist-error', { items: [] });
        return false;
      }

      const playlistItems = activePlaylist.items.map((item) => ({
        uri: item.media.s3Url,
        duration: item.duration ?? item.media.duration,
        id: item.id,
        mediaId: item.mediaId,
        orientation: item.orientation,
        rotation: item.rotation,
        width: item.media.width,
        height: item.media.height,
        title: item.media.title,
      }));

      client.emit('tv-find-playlist-success', {
        message: `Playlists pour la TV: ${data.tvId}`,
        playlistId: activePlaylist.id,
        items: playlistItems,
      });

      return true;
    } catch (error) {
      client.emit('tv-find-playlist-error', {
        message: 'Erreur lors de la récupération des playlists',
        error: error.message,
      });
      return false;
    }
  }

  @SubscribeMessage('tv-change-playlist')
  async handleChangePlaylist(
    @MessageBody()
    data: {
      tvId: string;
      newPlaylistId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.tvId) {
      throw new Error('Pas de TV indiqué');
    }

    if (!data.newPlaylistId) {
      throw new Error('Pas de playlist indiqué');
    }

    try {
      // ✅ Utilisez findUnique pour un ID unique
      const TV = await this.prisma.television.findUnique({
        where: {
          id: data.tvId,
        },
        include: {
          playlists: {
            include: {
              playlist: {
                include: {
                  items: {
                    include: {
                      media: true,
                    },
                    orderBy: {
                      order: 'asc', // ✅ Ordre des items
                    },
                  },
                  schedules: {
                    where: {
                      isActive: true,
                      OR: [{ televisionId: data.tvId }, { televisionId: null }],
                    },
                  },
                },
              },
            },
            where: {
              playlistId: data.newPlaylistId,
              isActive: true,
            },
          },
        },
      });

      if (!TV) {
        throw new Error(`TV avec l'ID ${data.tvId} introuvable`);
      }

      if (TV.playlists.length === 0) {
        console.log(
          '🚀 ~ WebsocketsGateway ~ handleChangePlaylist ~ TV.playlists.length :',
          TV.playlists.length,
        );

        await this.notifyTV(data.tvId, 'tv-change-playlist-error', {
          message: `Playlist ${data.newPlaylistId} non trouvée ou inactive pour cette TV`,
          playlistId: data.newPlaylistId,
          items: [],
        });

        return {
          success: false,
          message: `Playlist ${data.newPlaylistId} non trouvée ou inactive pour cette TV`,
          items: [],
        };
      }

      // ✅ Récupérer la playlist active
      const activePlaylist = TV.playlists[0].playlist;

      // Ce chemin est emprunté par l'app après un upload, une suppression ou
      // une réorganisation de médias. Sans ce contrôle, éditer une playlist
      // programmée la remettait à l'écran hors de sa fenêtre — et rien ne l'en
      // retirait ensuite.
      if (!canPlayNow(activePlaylist.schedules)) {
        this.logger.log(
          `⏭️ tv-change-playlist: "${activePlaylist.name}" hors de sa fenêtre, non poussée`,
        );

        const skipped = {
          message: `"${activePlaylist.name}" ne se diffuse que pendant sa programmation`,
          playlistId: activePlaylist.id,
          tvId: data.tvId,
        };
        client.emit('tv-change-playlist-skipped', skipped);

        return { success: false, skipped: true, ...skipped };
      }

      // console.log(
      //   '🚀 WebsocketsGateway ~ handleChangePlaylist ~ activePlaylist:',
      //   activePlaylist,
      // );

      // ✅ Préparer les items pour la réponse
      const playlistItems = activePlaylist.items.map((item) => ({
        uri: item.media.s3Url,
        duration: item.media.duration, // Utiliser la durée de l'item ou celle du média
        mediaId: item.mediaId,
        order: item.order,
        orientation: item.orientation,
        rotation: item.rotation,
        width: item.media.width,
        height: item.media.height,
      }));

      const response = {
        message: `tv-change-playlist-success Pour la room. tv:${data.tvId}`,
        playlistId: activePlaylist.id,
        playlistName: activePlaylist.name,
        items: playlistItems,
      };

      // ✅ Émettre au client qui a fait la demande
      client.emit('tv-change-playlist-success', response);

      // ✅ Notifier la TV
      await this.notifyTV(data.tvId, 'tv-change-playlist-success', response);

      return {
        success: true,
        tv: TV,
        playlist: activePlaylist,
        itemsCount: playlistItems.length,
      };
    } catch (error) {
      console.error('Erreur lors du changement de playlist:', error);

      // ✅ Émettre l'erreur au client
      client.emit('tv-change-playlist-error', {
        message: error.message,
        tvId: data.tvId,
        playlistId: data.newPlaylistId,
      });

      throw error; // ou return { success: false, error: error.message }
    }
  }

  // 🔌 Commande ON/OFF à distance
  @SubscribeMessage('tv-power')
  async handleTVPower(
    @MessageBody() data: { tvId: string; action: 'ON' | 'OFF' },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.tvId || !data?.action) {
      return { event: 'error', message: 'tvId et action requis' };
    }

    try {
      const status = data.action === 'ON' ? 'ONLINE' : 'OFFLINE';

      await this.prisma.television.update({
        where: { id: data.tvId },
        data: { status: status as any, lastSeen: new Date() },
      });

      // Notifier la TV.
      // `tvId` est inclus dans la charge utile : la room `tv:<id>` contient
      // aussi les dashboards observateurs, et sans cet identifiant un dashboard
      // qui surveille plusieurs écrans ne peut pas attribuer l'événement. Ajout
      // purement additif — la TV, elle, ne lit que `action`.
      this.notifyTV(data.tvId, 'tv-power', {
        tvId: data.tvId,
        action: data.action,
      });

      // Notifier l'app (tous les clients de la room)
      this.server.to(`tv:${data.tvId}`).emit('tv-status-update', {
        tvId: data.tvId,
        status,
      });

      client.emit('tv-power-success', { tvId: data.tvId, action: data.action });
      return { success: true };
    } catch (error) {
      this.logger.error(`❌ Erreur tv-power: ${error.message}`);
      client.emit('tv-power-error', { message: error.message });
      return { success: false };
    }
  }

  // 🎞️ La TV remonte le média qu'elle est en train d'afficher
  @SubscribeMessage('tv-now-playing')
  handleTVNowPlaying(
    @MessageBody()
    data: {
      tvId: string;
      mediaId?: string;
      mediaTitle?: string;
      playlistId?: string;
      playlistName?: string;
      index?: number;
      total?: number;
    },
  ) {
    try {
      // Ignoré silencieusement : cet événement arrive à chaque changement de
      // média, un log d'erreur par média pour une TV mal configurée noierait
      // les logs sans rien apporter.
      if (!data?.tvId) {
        return;
      }

      const state: NowPlayingState = {
        tvId: data.tvId,
        mediaId: data.mediaId,
        mediaTitle: data.mediaTitle,
        playlistId: data.playlistId,
        playlistName: data.playlistName,
        index: data.index,
        total: data.total,
        receivedAt: new Date().toISOString(),
      };

      this.nowPlaying.set(data.tvId, state);

      this.logger.log(
        `🎞️ Lecture en cours - TV: ${data.tvId}, Média: ${
          data.mediaTitle || data.mediaId || 'inconnu'
        }`,
      );

      // Rediffusion à la room de la TV : le dashboard qui observe cette TV
      // reçoit l'état sans passer par la base.
      this.notifyTV(data.tvId, 'tv-now-playing', state);

      return {
        event: 'now-playing-received',
        data: { tvId: data.tvId },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur tv-now-playing: ${error.message}`);
      return {
        event: 'error',
        message: 'Erreur lors de la remontée du média en cours',
      };
    }
  }

  // 📡 Le dashboard réclame l'état de lecture déjà connu du serveur
  @SubscribeMessage('dashboard-get-now-playing')
  handleDashboardGetNowPlaying(
    @MessageBody() data: { tvIds?: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const requestedIds = Array.isArray(data?.tvIds) ? data.tvIds : null;

      // Sans tvIds on renvoie tout ce qui est connu ; avec tvIds on ne renvoie
      // que les TVs demandées (une TV sans état connu est simplement absente).
      const states: NowPlayingState[] = requestedIds
        ? requestedIds
            .map((tvId) => this.nowPlaying.get(tvId))
            .filter((state): state is NowPlayingState => Boolean(state))
        : Array.from(this.nowPlaying.values());

      this.logger.log(
        `📡 État de lecture demandé par ${client.id} - ${states.length} TV(s)`,
      );

      client.emit('dashboard-now-playing', { states });

      return {
        event: 'now-playing-sent',
        data: { count: states.length },
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur dashboard-get-now-playing: ${error.message}`,
      );
      client.emit('dashboard-now-playing', { states: [] });
      return {
        event: 'error',
        message: 'Erreur lors de la récupération des états de lecture',
      };
    }
  }

  // 👀 Le dashboard s'abonne aux rooms des TVs qu'il affiche
  @SubscribeMessage('dashboard-watch-tvs')
  async handleDashboardWatchTvs(
    @MessageBody() data: { tvIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const tvIds = Array.isArray(data?.tvIds) ? data.tvIds : [];

      const validIds = tvIds.filter(
        (tvId) => typeof tvId === 'string' && tvId.length > 0,
      );

      for (const tvId of validIds) {
        await client.join(`tv:${tvId}`);
      }

      this.logger.log(
        `👀 Client ${client.id} observe ${validIds.length} TV(s): ${
          validIds.join(', ') || 'aucune'
        }`,
      );

      return {
        event: 'watching',
        count: validIds.length,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur dashboard-watch-tvs: ${error.message}`);
      return {
        event: 'error',
        message: "Erreur lors de l'abonnement aux TVs",
      };
    }
  }
}
