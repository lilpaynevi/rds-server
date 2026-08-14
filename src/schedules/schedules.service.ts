import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebsocketsGateway } from 'src/websockets/websockets.gateway';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly websocket: WebsocketsGateway,
  ) {}

  async findAll(user: any) {
    return this.prisma.schedule.findMany({
      where: { userId: user.sub },
      include: {
        television: { select: { id: true, name: true } },
        playlist: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTv(tvId: string) {
    return this.prisma.schedule.findMany({
      where: { televisionId: tvId },
      include: {
        playlist: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Prévient toutes les TVs qu'un changement de planning concerne.
   *
   * `schedule.televisionId` ne suffit pas : il est nullable (planning attaché à
   * la seule playlist), et une playlist peut être diffusée par plusieurs TVs —
   * via une assignation ou via leur file d'attente. Ne notifier que la TV
   * portée par le planning laissait les autres avec une programmation périmée
   * jusqu'à leur prochain redémarrage.
   *
   * `extraTelevisionIds` sert à prévenir aussi l'ancienne TV quand le planning
   * en change : sans ça, elle conserverait un planning qui ne la concerne plus.
   */
  private async notifyScheduleTargets(
    schedule: { televisionId?: string | null; playlistId?: string | null },
    extraTelevisionIds: (string | null | undefined)[] = [],
  ) {
    const televisionIds = new Set<string>();

    if (schedule.televisionId) televisionIds.add(schedule.televisionId);
    extraTelevisionIds.forEach((id) => id && televisionIds.add(id));

    if (schedule.playlistId) {
      const [assignments, queueEntries] = await Promise.all([
        this.prisma.playlistTelevision.findMany({
          where: { playlistId: schedule.playlistId },
          select: { televisionId: true },
        }),
        this.prisma.playlistQueueItem.findMany({
          where: { playlistId: schedule.playlistId },
          select: { televisionId: true },
        }),
      ]);

      [...assignments, ...queueEntries].forEach(
        (entry) => entry.televisionId && televisionIds.add(entry.televisionId),
      );
    }

    televisionIds.forEach((televisionId) =>
      this.websocket.notifyTV(televisionId, 'tv-schedules-updated', {}),
    );
  }

  async create(data: any, user: any) {
    const schedule = await this.prisma.schedule.create({
      data: { ...data, userId: user.sub },
    });
    await this.notifyScheduleTargets(schedule);
    return schedule;
  }

  async update(scheduleId: string, data: any, user: any) {
    const checkingSchedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId, userId: user.sub },
    });

    if (!checkingSchedule) {
      return new Error('Pas de planning existant');
    }

    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data,
    });

    // L'ancienne TV et l'ancienne playlist doivent être prévenues aussi, sinon
    // elles gardent une programmation qui ne les concerne plus.
    await this.notifyScheduleTargets(updated, [checkingSchedule.televisionId]);
    if (
      checkingSchedule.playlistId &&
      checkingSchedule.playlistId !== updated.playlistId
    ) {
      await this.notifyScheduleTargets({
        playlistId: checkingSchedule.playlistId,
      });
    }

    return updated;
  }

  async delete(scheduleId: string, user: any) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId, userId: user.sub },
    });
    if (!schedule) throw new NotFoundException('Planning introuvable');
    await this.prisma.schedule.delete({ where: { id: scheduleId } });
    // Résolu après suppression, mais à partir du planning lu avant : les TVs
    // concernées sont celles qu'il visait.
    await this.notifyScheduleTargets(schedule);
    return { success: true };
  }
}
