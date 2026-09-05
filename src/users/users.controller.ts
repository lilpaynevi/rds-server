import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Création de compte en back-office, réservée aux administrateurs.
   *
   * L'inscription publique passe désormais par POST /auth/register, qui valide
   * le SIRET, force `roles: USER` / `isVerify: false` et notifie les
   * administrateurs. Cette route-ci acceptait le corps brut (donc `roles` et
   * `isVerify`) sans authentification : elle contournait entièrement le
   * parcours de validation.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() createUserDto: User) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Cette route renvoie TOUS les utilisateurs avec leurs télévisions, donc leur
   * `codeConnection` — de quoi appairer l'écran de n'importe qui. Elle était
   * publique : n'importe quelle requête sans jeton pouvait la lire.
   *
   * Volontairement JwtAuthGuard SEUL, sans @Roles('ADMIN') : le dashboard
   * s'appuie sur cette réponse pour construire la page « Toutes les playlists »,
   * qui est ouverte à tous les comptes — un contrôle de rôle la viderait.
   * Reste à faire : restreindre la réponse au seul périmètre de l'appelant.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Liste les comptes en attente de validation : données personnelles de tiers
   * (e-mail, téléphone, société, SIRET). Réservée aux administrateurs.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('/not-verified')
  findAllNotVerified() {
    return this.usersService.findAllNotVerified();
  }

  /**
   * Valide (ou invalide) le compte d'un tiers. C'est cette route qui débloque
   * la connexion du demandeur et déclenche son e-mail d'activation.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('/:userId/verified')
  VerifiedUser(
    @Param('userId') userId: string,
    @Body() data: { isVerify: boolean | string },
  ) {
    // Le corps peut arriver en `"true"` / `"false"` selon le client : sans
    // coercition, la chaîne "false" est vraie et validerait le compte.
    const isVerify =
      typeof data.isVerify === 'string'
        ? data.isVerify === 'true'
        : Boolean(data.isVerify);

    return this.usersService.VerifiedUser(userId, isVerify);
  }

  /**
   * Renvoie un compte avec ses télévisions (donc son `codeConnection`), ses
   * playlists et son abonnement.
   * Reste à faire : l'`id` de l'URL n'est pas comparé à `user.sub`, un compte
   * authentifié peut donc encore lire la fiche d'un autre compte.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Mise à jour d'un compte. Le corps est passé tel quel à Prisma.
   * Reste à faire : vérifier que `id === user.sub` et filtrer les champs
   * modifiables (roles, isVerify, password ne devraient pas être libres).
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Suppression définitive d'un compte (annulation Stripe + purge des médias).
   * Elle était déclenchable sans jeton sur n'importe quel identifiant.
   * Reste à faire : même contrôle d'appartenance que ci-dessus.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
