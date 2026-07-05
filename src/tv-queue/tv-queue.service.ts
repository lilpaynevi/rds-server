import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketsGateway } from 'src/websockets/websockets.gateway';

@Injectable()
export class TvQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketsGateway,
  ) {}

  async findByTv(televisionId: string, user: any) {
    return this.prisma.playlistQueueItem.findMany({
      where: { televisionId, userId: user.sub },
      include: { playlist: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addToQueue(data: { televisionId: string; playlistId: string }, user: any) {
    const last = await this.prisma.playlistQueueItem.findFirst({
      where: { televisionId: data.televisionId },
      orderBy: { position: 'desc' },
    });

    const item = await this.prisma.playlistQueueItem.create({
      data: {
        televisionId: data.televisionId,
        playlistId: data.playlistId,
        userId: user.sub,
        position: (last?.position ?? -1) + 1,
      },
      include: { playlist: { select: { id: true, name: true } } },
    });

    this.websocket.notifyTV(data.televisionId, 'tv-queue-updated', {});
    return item;
  }

  async reorder(
    data: { televisionId: string; items: { id: string; position: number }[] },
    user: any,
  ) {
    await this.prisma.$transaction(
      data.items.map((item) =>
        this.prisma.playlistQueueItem.update({
          where: { id: item.id, televisionId: data.televisionId, userId: user.sub },
          data: { position: item.position },
        }),
      ),
    );

    this.websocket.notifyTV(data.televisionId, 'tv-queue-updated', {});
    return { success: true };
  }

  async remove(id: string, user: any) {
    const item = await this.prisma.playlistQueueItem.findUnique({
      where: { id, userId: user.sub },
    });
    if (!item) throw new NotFoundException('Élément de la file introuvable');

    await this.prisma.playlistQueueItem.delete({ where: { id } });
    this.websocket.notifyTV(item.televisionId, 'tv-queue-updated', {});
    return { success: true };
  }
}
