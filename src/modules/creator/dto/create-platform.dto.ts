import { IsString, IsEnum, IsOptional, IsUrl, IsUUID } from 'class-validator';

import { PlatformType } from '../entities/creator-platform.entity.js';

export class CreatePlatformDto {
  @IsUUID()
  creatorId!: string;

  @IsEnum(PlatformType)
  platformType!: PlatformType;

  @IsString()
  platformId!: string;

  @IsOptional()
  @IsString()
  platformUsername?: string;

  @IsOptional()
  @IsUrl()
  platformUrl?: string;
}
