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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Création de compte : seule route du contrôleur laissée ouverte.
   * C'est le point d'entrée de l'inscription (le service hache le mot de passe
   * et refuse un e-mail déjà pris) ; elle ne lit aucune donnée d'un autre
   * compte. La poser derrière JwtAuthGuard rendrait toute inscription
   * impossible.
   */
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
   * et aucun compte n'est aujourd'hui provisionné ADMIN en base — un contrôle de
   * rôle viderait la page pour tout le monde. Reste à faire : durcir en
   * @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('ADMIN') une fois les comptes
   * administrateurs provisionnés, ou restreindre la réponse au seul périmètre de
   * l'appelant.
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Liste les comptes en attente de validation : données personnelles de tiers
   * (e-mail, téléphone, société). Réservée aux sessions authentifiées.
   * Même remarque que ci-dessus sur le durcissement ADMIN à venir : cette page
   * d'approbation est une fonction d'administration.
   */
  @UseGuards(JwtAuthGuard)
  @Get('/not-verified')
  findAllNotVerified() {
    return this.usersService.findAllNotVerified();
  }

  /**
   * Valide (ou invalide) le compte d'un tiers — action d'administration qui
   * était exécutable sans aucun jeton.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('/:userId/verified')
  VerifiedUser(
    @Param('userId') userId: string,
    @Body() data: { isVerify: boolean },
  ) {
    const isVerify = data.isVerify;
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
