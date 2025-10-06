// src/televisions/dto/create-television.dto.ts
import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Resolution, Orientation, TransitionEffect } from '@prisma/client';

export class CreateTelevisionDto {
  @IsString()
  name: string;

  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Resolution)
  resolution?: Resolution;

  @IsOptional()
  @IsEnum(Orientation)
  orientation?: Orientation;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  volume?: number;

  @IsOptional()
  @IsBoolean()
  autoPlay?: boolean;

  @IsOptional()
  @IsBoolean()
  loop?: boolean;

  @IsOptional()
  @IsEnum(TransitionEffect)
  transition?: TransitionEffect;

  @IsOptional()
  @IsInt()
  @Min(1)
  refreshRate?: number;

  @IsString()
  codeConnection: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
