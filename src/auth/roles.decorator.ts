import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route — ou un contrôleur entier — aux rôles listés.
 * À combiner avec les deux gardes : @UseGuards(JwtAuthGuard, RolesGuard).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
