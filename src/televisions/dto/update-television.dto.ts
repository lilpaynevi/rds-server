// src/televisions/dto/update-television.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateTelevisionDto } from './create-television.dto';

export class UpdateTelevisionDto extends PartialType(CreateTelevisionDto) {}
