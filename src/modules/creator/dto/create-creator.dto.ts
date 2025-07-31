import { IsString, IsOptional, IsArray, IsEnum, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { PlatformType } from '@common/enums/index.js';

class CreateCreatorPlatformDto {
  @IsEnum(PlatformType)
  type!: PlatformType;

  @IsString()
  platformId!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  followerCount?: number = 0;
}

export class CreateCreatorDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  name!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreatorPlatformDto)
  platforms!: CreateCreatorPlatformDto[];
}