// src/televisions/televisions.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTelevisionDto } from './dto/create-television.dto';
import { UpdateTelevisionDto } from './dto/update-television.dto';
import { QueryTelevisionDto } from './dto/query-television.dto';
import { Prisma, Television } from '@prisma/client';
import * as crypto from 'crypto';
import { WebsocketsGateway } from 'src/websockets/websockets.gateway';
@Injectable()
export class TelevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private websocket: WebsocketsGateway,
  ) {}

  async generateSecureNineDigitCode() {
    // Génère 4 bytes aléatoirement avec crypto
    const randomBytes = crypto.randomBytes(4);

    // Convertit en nombre et assure 9 chiffres
    const randomNumber = randomBytes.readUInt32BE(0);
    const nineDigitCode = (randomNumber % 900000000) + 100000000;

    return nineDigitCode.toString();
  }

  // async create(createTelevisionDto: CreateTelevisionDto) {
  //   try {
  //     // Vérifier si le deviceId existe déjà
  //     const existingTelevision = await this.prisma.television.findUnique({
  //       where: { deviceId: createTelevisionDto.deviceId },
  //     });

  //     if (existingTelevision) {
  //       throw new ConflictException(
  //         'Television with this deviceId already exists',
  //       );
  //     }

  //     // Vérifier si l'utilisateur existe (si fourni)
  //     if (createTelevisionDto.userId) {
  //       const user = await this.prisma.user.findUnique({
  //         where: { id: createTelevisionDto.userId },
  //       });

  //       if (!user) {
  //         throw new BadRequestException('User not found');
  //       }
  //     }

  //     const codeConnection = await this.generateSecureNineDigitCode(); // Ex: "847293016"

  //     const newTV = {
  //       ...createTelevisionDto,
  //       codeConnection: String(codeConnection),
  //     };

  //     const television = await this.prisma.television.create({
  //       data: newTV,
  //       include: {
  //         user: true,
  //         playlists: {
  //           include: {
  //             playlist: true,
  //           },
  //         },
  //       },
  //     });

  //     return television;
  //   } catch (error) {
  //     if (
  //       error instanceof ConflictException ||
  //       error instanceof BadRequestException
  //     ) {
  //       throw error;
  //     }
  //     throw new BadRequestException('Failed to create television : ' + error);
  //   }
  // }

  // async findAll(query: QueryTelevisionDto) {
  //   const {
  //     page = 1,
  //     limit = 10,
  //     search,
  //     status,
  //     resolution,
  //     orientation,
  //     userId,
  //     includeUser,
  //     includePlaylists,
  //   } = query;

  //   const skip = (page - 1) * limit;
  //   const take = limit;

  //   // Construction des filtres
  //   const where: Prisma.TelevisionWhereInput = {};

  //   if (search) {
  //     where.OR = [
  //       { name: { contains: search, mode: 'insensitive' } },
  //       { location: { contains: search, mode: 'insensitive' } },
  //       { description: { contains: search, mode: 'insensitive' } },
  //       { deviceId: { contains: search, mode: 'insensitive' } },
  //     ];
  //   }

  //   if (status) {
  //     where.status = status;
  //   }

  //   if (resolution) {
  //     where.resolution = resolution;
  //   }

  //   if (orientation) {
  //     where.orientation = orientation;
  //   }

  //   if (userId) {
  //     where.userId = userId;
  //   }

  //   // Construction des includes
  //   const include: Prisma.TelevisionInclude = {};

  //   if (includeUser) {
  //     include.user = true;
  //   }

  //   if (includePlaylists) {
  //     include.playlists = {
  //       include: {
  //         playlist: true,
  //       },
  //     };
  //   }

  //   const [televisions, total] = await Promise.all([
  //     this.prisma.television.findMany({
  //       where,
  //       include,
  //       skip,
  //       take,
  //       orderBy: {
  //         createdAt: 'desc',
  //       },
  //     }),
  //     this.prisma.television.count({ where }),
  //   ]);

  //   return {
  //     data: televisions,
  //     meta: {
  //       page,
  //       limit,
  //       total,
  //       totalPages: Math.ceil(total / limit),
  //       hasNext: page * limit < total,
  //       hasPrev: page > 1,
  //     },
  //   };
  // }

  async findAll() {
    return this.prisma.television.findMany({
      include: {
        playlists: true,
      },
    });
  }

  async findAllDashboard() {
    const res = await this.prisma.television.findMany({
      where: {
        NOT: {
          userId: null,
        },
      },
      include: {
        playlists: {
          where: {
            playlist: {
              isActive: true,
            },
          },
          include: {
            playlist: {
              include: {
                items: {
                  include: {
                    media: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            lastName: true,
            firstName: true,
            city: true,
            department: true,
            id: true,
          },
        },
      },
    });

    return res;
  }

  async checkCodeOrCreate(data: any) {
    // 🔍 Validation des données
    if (!data.code) {
      throw new Error('Code manquant');
    }

    // if (!data.name) {
    //   throw new Error('Nom de TV manquant');
    // }

    try {
      // 🔍 Chercher TV existante par code (findFirst plus approprié)
      const existingTV = await this.prisma.television.findFirst({
        where: {
          codeConnection: data.code,
        },
        include: {
          // ⚠️ Route volontairement NON authentifiée (appairage de l'écran) :
          // `user: true` renvoyait tout l'objet User, donc le hash bcrypt du
          // mot de passe et le jeton de réinitialisation, à quiconque devine un
          // code à 9 chiffres. On énumère ici tous les champs SAUF les secrets,
          // pour ne rien retirer à ce que l'écran affiche déjà.
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              department: true,
              city: true,
              avatar: true,
              phone: true,
              role: true,
              roles: true,
              isActive: true,
              isVerify: true,
              lastLogin: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (existingTV) {
        console.log('📺 TV existante trouvée avec code:', data.code);

        return {
          ...existingTV,
          isNew: false,
        };
      }

      // 🆕 Créer nouvelle TV si inexistante
      console.log('🆕 Création nouvelle TV avec code:', data.code);
      const newTV = await this.prisma.television.create({
        data: {
          name: data.name,
          codeConnection: data.code,
          // deviceId: data.deviceId || `device_${Date.now()}`,
        },
      });

      return {
        ...newTV,
        isNew: true,
        isSynced: false,
      };
    } catch (error) {
      console.error('❌ Erreur dans checkCodeOrCreate:', error);
      throw new Error(
        `Erreur lors de la vérification/création TV: ${error.message}`,
      );
    }
  }

  async findOne(id: string, includeUser = false, includePlaylists = false) {
    const include: Prisma.TelevisionInclude = {};

    if (includeUser) {
      include.user = true;
    }

    if (includePlaylists) {
      include.playlists = {
        include: {
          playlist: true,
        },
      };
    }

    const television = await this.prisma.television.findUnique({
      where: { id },
      include,
    });

    if (!television) {
      throw new NotFoundException('Television not found');
    }

    return television;
  }

  // async findByDeviceId(deviceId: string) {
  //   const television = await this.prisma.television.findUnique({
  //     where: { deviceId },
  //     include: {
  //       user: true,
  //     },
  //   });

  //   if (!television) {
  //     throw new NotFoundException('Television not found');
  //   }

  //   return television;
  // }

  async update(id: string, updateTelevisionDto: UpdateTelevisionDto) {
    // Vérifier si la télévision existe
    const existingTelevision = await this.prisma.television.findUnique({
      where: { id },
    });

    if (!existingTelevision) {
      throw new NotFoundException('Television not found');
    }

    try {
      // Vérifier si le deviceId n'est pas déjà utilisé par une autre télévision

      // Vérifier si l'utilisateur existe (si fourni)
      if (updateTelevisionDto.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: updateTelevisionDto.userId },
        });

        if (!user) {
          throw new BadRequestException('User not found');
        }
      }

      const updatedTelevision = await this.prisma.television.update({
        where: { id },
        data: updateTelevisionDto,
        include: {
          user: true,
          playlists: {
            include: {
              playlist: true,
            },
          },
        },
      });

      this.websocket.notifyTV(id, 'tv-settings-update', {
        name: updatedTelevision.name,
        orientation: updatedTelevision.orientation,
        transition: updatedTelevision.transition,
        loop: updatedTelevision.loop,
        autoPlay: updatedTelevision.autoPlay,
        volume: updatedTelevision.volume,
        refreshRate: updatedTelevision.refreshRate,
        powerOnTime: updatedTelevision.powerOnTime ?? null,
        powerOffTime: updatedTelevision.powerOffTime ?? null,
      });

      return updatedTelevision;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update television');
    }
  }

  async updateStatus(id: string, status: string) {
    const existingTelevision = await this.prisma.television.findUnique({
      where: { id },
    });

    if (!existingTelevision) {
      throw new NotFoundException('Television not found');
    }

    const updatedTelevision = await this.prisma.television.update({
      where: { id },
      data: {
        status: status as any,
        lastSeen: new Date(),
      },
    });

    this.websocket.notifyTV(id, 'tv-status-update', {
      tvId: id,
      status: updatedTelevision.status,
    });

    return updatedTelevision;
  }

  async remove(id: string) {
    const existingTelevision = await this.prisma.television.findUnique({
      where: { id },
    });

    if (!existingTelevision) {
      throw new NotFoundException('Television not found');
    }

    await this.prisma.television.delete({
      where: { id },
    });

    return { message: 'Television deleted successfully' };
  }

  async deleteTelevisionWithCleanup(televisionId: string, user: any) {
    try {
      const existingTelevision = await this.prisma.television.findUnique({
        where: { id: televisionId },
      });

      if (!existingTelevision) {
        throw new NotFoundException('Television not found');
      }

      // Contrôle de propriété — indispensable depuis que le dashboard expose un
      // bouton de suppression : la route n'était gardée que par JwtAuthGuard,
      // donc tout compte authentifié pouvait supprimer définitivement l'écran
      // d'un autre client en connaissant son identifiant. Même dérogation ADMIN
      // que `getQueue`, qui porte déjà ce contrôle.
      await this.assertCanManageTelevision(existingTelevision, user);

      await this.prisma.$transaction(async (tx) => {
        // 1. Supprimer les associations PlaylistTelevision
        await tx.playlistTelevision.deleteMany({
          where: { televisionId },
        });

        // 2. Déassigner les Schedules (mettre televisionId à null au lieu de supprimer)
        await tx.schedule.deleteMany({
          where: { televisionId },
        });

        // 3. Finalement, supprimer la télévision
        await tx.television.delete({
          where: { id: televisionId },
        });

        // ⚠️ Le payload JWT expose l'id sous `sub` (auth.service.ts:46), pas
        // sous `id`. Avec `userId: user.id` (undefined), Prisma ignore le
        // filtre : le decrement s'appliquait à TOUS les abonnements MAIN de la
        // base à chaque suppression d'écran.
        //
        // Le quota à décrémenter est celui du PROPRIÉTAIRE de l'écran, pas de
        // l'appelant : un administrateur qui supprime l'écran d'un client
        // décrémenterait sinon son propre abonnement, en laissant le compteur
        // du client gonflé à vie.
        const ownerId = existingTelevision.userId ?? user?.sub ?? user?.id;

        if (ownerId) {
          await tx.subscription.updateMany({
            data: {
              usedScreens: {
                decrement: 1,
              },
            },
            where: {
              userId: ownerId,
              plan: {
                planType: 'MAIN',
              },
              usedScreens: {
                gt: 0,
              },
            },
          });
        }
      });

      return { success: true, message: 'Télévision supprimée avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de la télévision:', error);
      throw error;
    }
  }

  async MyTVs(user: any) {
    return this.prisma.television.findMany({
      where: {
        userId: user?.sub,
      },
      include: {
        playlists: {
          include: {
            playlist: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Autorise l'accès à un écran : son propriétaire, ou un administrateur.
   *
   * Les routes concernées ne sont gardées que par `JwtAuthGuard`, qui vérifie
   * l'authentification mais pas l'appartenance. Sans ce contrôle, tout compte
   * authentifié agirait sur l'écran d'un autre client en connaissant son
   * identifiant.
   *
   * Le rôle est lu sur les DEUX colonnes `role` et `roles` : le schéma en porte
   * deux, toutes deux `@default(USER)`, et selon les comptes c'est l'une ou
   * l'autre qui est renseignée. Même règle que `RolesGuard`.
   */
  private async assertCanManageTelevision(
    television: { userId?: string | null },
    user: any,
  ) {
    if (!user?.sub) return;
    if (television.userId === user.sub) return;

    const requester = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { role: true, roles: true },
    });

    if (requester?.role !== 'ADMIN' && requester?.roles !== 'ADMIN') {
      throw new ForbiddenException(
        'Accès refusé : cet écran ne vous appartient pas',
      );
    }
  }

  /**
   * File d'attente d'un écran, pour le dashboard.
   * On ne remonte que le NOMBRE de médias par playlist (et pas les médias) : la file
   * peut contenir plusieurs playlists, en charger tous les items serait inutile ici.
   */
  async getQueue(tvId: string, user?: any) {
    const television = await this.prisma.television.findUnique({
      where: { id: tvId },
      select: { id: true, userId: true },
    });

    if (!television) {
      throw new NotFoundException('Écran introuvable');
    }

    // La route n'est gardée que par JwtAuthGuard : sans ce contrôle, n'importe quel
    // compte authentifié lirait la file d'un écran appartenant à un autre client.
    await this.assertCanManageTelevision(television, user);

    const queueItems = await this.prisma.playlistQueueItem.findMany({
      where: { televisionId: tvId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        position: true,
        playlistId: true,
        playlist: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            _count: {
              select: { items: true },
            },
            // Programmations actives visant cet écran, ou globales (televisionId null) :
            // permet au dashboard de signaler qu'une playlist est pilotée par un horaire.
            schedules: {
              where: {
                isActive: true,
                OR: [{ televisionId: tvId }, { televisionId: null }],
              },
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                startTime: true,
                endTime: true,
                daysOfWeek: true,
                priority: true,
                overridePlaylist: true,
                televisionId: true,
              },
              orderBy: [{ priority: 'desc' }, { startTime: 'asc' }],
            },
          },
        },
      },
    });

    return queueItems.map((item) => ({
      id: item.id,
      playlistId: item.playlistId,
      position: item.position,
      playlist: {
        id: item.playlist.id,
        name: item.playlist.name,
        description: item.playlist.description,
        isActive: item.playlist.isActive,
      },
      mediaCount: item.playlist._count.items,
      schedules: item.playlist.schedules,
    }));
  }

  async getStatistics() {
    const [total, online, offline, playing, byResolution] = await Promise.all([
      this.prisma.television.count(),
      this.prisma.television.count({ where: { status: 'ONLINE' } }),
      this.prisma.television.count({ where: { status: 'OFFLINE' } }),
      this.prisma.television.count({ where: { status: 'PLAYING' } }),
      this.prisma.television.groupBy({
        by: ['resolution'],
        _count: true,
      }),
    ]);

    return {
      total,
      online,
      offline,
      playing,
      byResolution: byResolution.reduce((acc, item) => {
        acc[item.resolution] = item._count;
        return acc;
      }, {}),
    };
  }

  async dissociatedUserToTV(tvId: string, user: any) {
    const findTV = await this.prisma.television.findUnique({
      where: {
        id: tvId,
      },
    });
    console.log(
      '🚀 ~ TelevisionsService ~ dissociatedUserToTV ~ findTV:',
      findTV,
    );

    if (!findTV) {
      return new Error('Pas de TV trouvé pour ' + tvId);
    }

    if (findTV.userId === user.sub) {
      const dissociatedTV = await this.prisma.television.updateMany({
        data: {
          userId: null,
        },
        where: {
          id: tvId,
          userId: findTV.userId,
        },
      });

      const changeUserBaseSecreen = await this.prisma.subscription.updateMany({
        data: {
          usedScreens: {
            decrement: 1,
          },
        },
        where: {
          userId: user?.sub,
          plan: {
            planType: 'MAIN',
          },
          usedScreens: {
            gt: 0,
          },
        },
      });

      const disconnectAllPlaylist =
        await this.prisma.playlistTelevision.updateMany({
          data: {
            televisionId: null,
          },
          where: {
            televisionId: tvId,
          },
        });

      const dissociatedSchedules = await this.prisma.schedule.updateMany({
        data: {
          televisionId: null,
        },
        where: {
          televisionId: tvId,
        },
      });

      return {
        success: true,
        metadata: {
          tv: dissociatedTV,
          userScreen: changeUserBaseSecreen.count,
          disconnectAllPlaylist,
          dissociatedSchedules,
        },
      };
    } else {
      return {
        success: false,
        error: 'la TV n est pas lié à l user',
      };
    }
  }
}
