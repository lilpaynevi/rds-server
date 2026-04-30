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

  async create(data: any, user: any) {
    const schedule = await this.prisma.schedule.create({
      data: { ...data, userId: user.sub },
    });
    if (schedule.televisionId) {
      this.websocket.notifyTV(schedule.televisionId, 'tv-schedules-updated', {});
    }
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

    if (updated.televisionId) {
      this.websocket.notifyTV(updated.televisionId, 'tv-schedules-updated', {});
    }

    return updated;
  }

  async delete(scheduleId: string, user: any) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId, userId: user.sub },
    });
    if (!schedule) throw new NotFoundException('Planning introuvable');
    await this.prisma.schedule.delete({ where: { id: scheduleId } });
    if (schedule.televisionId) {
      this.websocket.notifyTV(schedule.televisionId, 'tv-schedules-updated', {});
    }
    return { success: true };
  }
}
