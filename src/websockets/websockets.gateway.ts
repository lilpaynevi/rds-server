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

interface ConnectedDevice {
  deviceId: string;
  socketId: string;
  connectedAt: Date;
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
              id: true
            },
          },
          televisions: true,
        },
      });

      const userMaxScreen =
        existingUser && existingUser.Subscription[0].currentMaxScreens;

      const userNumberTVAssocited =
        existingUser && existingUser.televisions.length;

      const existingCode = await this.prisma.television.findFirst({
        where: {
          codeConnection: data.code,
        },
      });

      if (!existingCode) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: 'Code de connexion invalide',
        });
        return 'pas de code existant';
      }

      if (existingUser && !userMaxScreen) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: 'Vous devez avoir un abonnement pour ajouter une TV',
        });

        return 'Vous devez avoir un abonnement pour ajouter une TV';
      }

      if (existingUser && userNumberTVAssocited === userMaxScreen) {
        client.emit('connect-tv-code-error', {
          status: false,
          error: `Vous avez déjà dépassé votre capacité d'écran pour votre abonnement ! Merci de souscrire à 'Option Ecran Supplémentaire'`,
        });

        return `Vous avez déjà dépassé votre capacité d'écran pour votre abonnement ! Merci de souscrire à 'Option Ecran Supplémentaire'`;
      }

      if (existingCode && typeof existingCode.userId === null) {
        console.log(
          '🚀 ~ WebsocketsGateway ~ handleTVConnectionWithCode ~  typeof existingCode.userId:',
          typeof existingCode.userId,
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
            usedScreens: {
              increment: 1
            },
          },
          where: {
            id: existingUser.Subscription[0].id,
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

  // 🔄 Méthode helper pour notifier une TV spécifique
  notifyTV(deviceId: string, event: string, data: any): boolean {
    try {
      this.server.to(`tv:${deviceId}`).emit(event, data);
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
  handleLeaveRoom(
    @MessageBody() data: { roomName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { roomName } = data;

      if (!roomName) {
        return { event: 'error', message: 'Nom de room requis' };
      }

      client.leave(roomName);

      this.logger.log(`🏠 Client ${client.id} a quitté la room ${roomName}`);

      // Notifie les autres clients de la room
      client.to(roomName).emit('user-left-room', {
        socketId: client.id,
        roomName: roomName,
        timestamp: new Date(),
      });

      return {
        event: 'room-left',
        data: {
          roomName,
          socketId: client.id,
          message: `Quitté la room ${roomName} avec succès`,
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
      // Récupération des playlists actives pour la TV
      const tvWithPlaylists = await this.prisma.television.findUnique({
        where: { id: data.tvId },
        include: {
          playlists: {
            include: {
              playlist: {
                include: {
                  items: {
                    include: { media: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!tvWithPlaylists) {
        client.emit('tv-find-playlist-error', { message: 'TV non trouvée' });
        return false;
      }

      // Extraction des items des playlists
      const playlistItems = tvWithPlaylists.playlists.flatMap((tvPlaylist) =>
        tvPlaylist.playlist.items.map((item) => ({
          uri: item.media.s3Url,
          duration: item.duration,
          id: item.id, // Optionnel: utile pour le frontend
        })),
      );

      client.emit('tv-find-playlist-success', {
        message: `Playlists pour la TV: ${data.tvId}`,
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
        throw new Error(
          `Playlist ${data.newPlaylistId} non trouvée ou inactive pour cette TV`,
        );
      }

      // ✅ Récupérer la playlist active
      const activePlaylist = TV.playlists[0].playlist;

      // console.log(
      //   '🚀 WebsocketsGateway ~ handleChangePlaylist ~ activePlaylist:',
      //   activePlaylist,
      // );

      // ✅ Préparer les items pour la réponse
      const playlistItems = activePlaylist.items.map((item) => ({
        uri: item.media.s3Url,
        duration: item.duration || item.media.duration, // Utiliser la durée de l'item ou celle du média
        mediaId: item.mediaId,
        order: item.order,
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
}
