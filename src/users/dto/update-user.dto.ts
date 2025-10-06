import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsInt, IsBoolean, IsString, IsDateString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { Transform } from 'class-transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_follower?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_following?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_like?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_visit?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_post?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  number_mission?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  count_sponso?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  first_post?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_admin?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_admin_messagerie?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_preference?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_muted_notification?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  is_account_certified?: boolean;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsDateString()
  date_token?: string;

  @IsOptional()
  @IsDateString()
  date_last_connexion?: string;

  @IsOptional()
  @IsString()
  api_token?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => Boolean(value))
  block?: boolean;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  jeton?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  note?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  count_recommandation?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  count_avis?: number;

  @IsOptional()
  @IsString()
  is_compress?: string;
}
