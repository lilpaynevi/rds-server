import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

/**
 * À poser APRÈS JwtAuthGuard : `@UseGuards(JwtAuthGuard, RolesGuard)`.
 *
 * Le rôle est relu en base plutôt que dans le JWT : le jeton embarque une copie
 * du compte figée à la connexion, un rôle retiré resterait donc valable jusqu'à
 * expiration du jeton.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException(
        'Session invalide : le jeton ne porte pas d\'identifiant de compte',
      );
    }

    // `role` fait foi. `roles` est l'ancienne colonne synonyme, conservée le
    // temps d'être supprimée : elle n'est lue ici que pour signaler une
    // divergence, qui est la cause la plus fréquente d'un 403 inattendu.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, roles: true },
    });

    if (!user) {
      throw new ForbiddenException('Compte introuvable');
    }

    if (!requiredRoles.includes(user.role)) {
      const mismatch =
        user.roles !== user.role
          ? ` — la colonne obsolète \`roles\` vaut ${user.roles}, mais c'est \`role\` qui fait foi`
          : '';

      throw new ForbiddenException(
        `Cette action est réservée aux administrateurs. Rôle du compte : ${user.role}${mismatch}`,
      );
    }

    return true;
  }
}
