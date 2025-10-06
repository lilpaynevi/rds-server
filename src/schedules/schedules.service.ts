import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(data: any, user: any) {
    return this.prisma.schedule.create({
      data: {
        ...data,
        userId: user.sub,
      },
    });
  }

  async update(scheduleId: string, data: any, user: any) {
    const checkingSchedule = await this.prisma.schedule.findUnique({
      where: {
        id: scheduleId,
        userId: user.sub,
      },
    });

    if (!checkingSchedule) {
      return new Error('Pas de planning existant');
    }

    return this.prisma.schedule.updateMany({
      where: {
        id: scheduleId,
      },
      data,
    });
  }
}
