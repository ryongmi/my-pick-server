import { IsString, IsEnum, IsOptional, IsUrl, IsUUID, IsDate, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  thumbnail!: string;

  @IsUrl()
  url!: string;

  @IsEnum(PlatformType)
  platform!: PlatformType;

  @IsString()
  platformId!: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsDate()
  @Type(() => Date)
  publishedAt!: Date;

  @IsUUID()
  creatorId!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  isLive?: boolean;

  @IsOptional()
  @IsEnum(['sd', 'hd', '4k'])
  quality?: 'sd' | 'hd' | '4k';

  @IsOptional()
  @IsBoolean()
  ageRestriction?: boolean;
}
