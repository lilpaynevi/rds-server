// src/televisions/dto/query-television.dto.ts
import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TelevisionStatus, Resolution, Orientation } from '@prisma/client';

export class QueryTelevisionDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TelevisionStatus)
  status?: TelevisionStatus;

  @IsOptional()
  @IsEnum(Resolution)
  resolution?: Resolution;

  @IsOptional()
  @IsEnum(Orientation)
  orientation?: Orientation;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeUser?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includePlaylists?: boolean;
}
