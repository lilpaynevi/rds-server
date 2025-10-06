import {
  IsEmail,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEnum,
  MinLength,
  IsPhoneNumber,
} from 'class-validator';
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum GenderEnum {
  MALE = 0,
  FEMALE = 1,
  OTHER = 2,
}

export enum StatusEnum {
  DISABLED = 0,
  ACTIVE = 1,
  PENDING = 2,
}

export enum FirstConnexionEnum {
  PROFILE = 0,
  STEP_1 = 1,
  STEP_2 = 2,
  STEP_3 = 3,
}

export class CreateUserDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  roles: string;

  @IsOptional()
  @IsEnum(GenderEnum)
  gender?: GenderEnum;

  @IsEnum(StatusEnum)
  status: StatusEnum;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  general_name?: string;

  @IsOptional()
  @IsString()
  support?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  iso_country?: string;

  @IsOptional()
  @IsString()
  share_link?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsString()
  code_phone?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  accept_newsletter?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_premium?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_gift_premium?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_account_private?: boolean;

  @IsOptional()
  @IsEnum(FirstConnexionEnum)
  first_connexion?: FirstConnexionEnum;

  @IsOptional()
  @IsString()
  token_fcm?: string;

  @IsOptional()
  @IsString()
  profile_picture?: string;

  @IsOptional()
  @IsString()
  profile_demo?: string;

  @IsOptional()
  @IsString()
  cv_artist?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
