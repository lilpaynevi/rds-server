import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsSiret, normalizeSiret } from 'src/common/validators/siret.validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Corps attendu par POST /auth/register.
 *
 * Le contrôleur applique un ValidationPipe en `whitelist` + `forbidNonWhitelisted` :
 * tout champ absent de ce DTO fait échouer la requête. C'est ce qui empêche un
 * client d'envoyer `roles: "ADMIN"` ou `isVerify: true` dans le corps
 * d'inscription — l'ancien handler passait le corps brut à Prisma.
 */
export class RegisterAuthDto {
  @IsString()
  @Transform(trim)
  @IsNotEmpty({ message: 'Le nom est requis' })
  @MinLength(2, { message: 'Le nom doit comporter au moins 2 caractères' })
  @MaxLength(80)
  lastName: string;

  @IsString()
  @Transform(trim)
  @IsNotEmpty({ message: 'Le prénom est requis' })
  @MinLength(2, { message: 'Le prénom doit comporter au moins 2 caractères' })
  @MaxLength(80)
  firstName: string;

  // Obligatoire : les comptes sont désormais réservés aux professionnels.
  @IsString()
  @Transform(trim)
  @IsNotEmpty({ message: "Le nom de l'entreprise est requis" })
  @MinLength(2, { message: "Le nom de l'entreprise est trop court" })
  @MaxLength(120)
  company: string;

  @IsSiret()
  @Transform(({ value }) => normalizeSiret(value))
  siret: string;

  @IsEmail({}, { message: "Format d'e-mail invalide" })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit comporter au moins 8 caractères',
  })
  @MaxLength(72, {
    // bcrypt tronque silencieusement au-delà de 72 octets : mieux vaut refuser
    // que laisser croire à l'utilisateur que la fin de son mot de passe compte.
    message: 'Le mot de passe ne doit pas dépasser 72 caractères',
  })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(30)
  phone?: string;
}
