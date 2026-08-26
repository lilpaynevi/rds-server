import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';

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

    // Route sans @Roles() : aucune restriction de rôle, on laisse passer.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const payload = request.user;

    if (!payload?.sub) {
      throw new UnauthorizedException(
        'Authentification requise : placez JwtAuthGuard avant RolesGuard.',
      );
    }

    // Le rôle est relu en base plutôt que pris dans le token. Le token en contient
    // pourtant une copie (login() signe l'objet User entier sous payload.user), mais
    // JwtModule.register est configuré sans expiration : cette copie est figée à la
    // connexion et un rôle modifié depuis ne serait jamais répercuté.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      // Le modèle User porte DEUX colonnes de rôle (`role` et `roles`,
      // schema.prisma:22 et :25), toutes deux `@default(USER)`, et aucune ne
      // fait autorité : la seule requête applicative qui lit un rôle filtre sur
      // `roles` (users.service.ts:72), alors que ce garde a été écrit sur
      // `role`. Ne lire qu'une des deux colonnes revient à parier sur
      // la façon dont la base a été alimentée — et si le pari est perdu, TOUTE
      // route @Roles('ADMIN') renvoie 403 aux administrateurs, ce qui rend le
      // back-office inutilisable. On accepte donc l'une OU l'autre, le temps
      // qu'une migration supprime la colonne en trop.
      select: { role: true, roles: true },
    });

    if (!user) {
      throw new ForbiddenException('Accès refusé : utilisateur introuvable.');
    }

    const grantedRoles = [user.role, user.roles];

    if (!grantedRoles.some((role) => requiredRoles.includes(role))) {
      throw new ForbiddenException(
        `Accès refusé : cette action requiert le rôle ${requiredRoles.join(' ou ')}.`,
      );
    }

    return true;
  }
}
