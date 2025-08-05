import { IsOptional, IsString, IsArray, IsNumber, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';

export class ContentSearchQueryDto {
  @IsOptional()
  @IsString()
  creatorId?: string | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  creatorIds?: string[] | undefined;

  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType | undefined;

  @IsOptional()
  @IsString()
  platform?: string | undefined;

  @IsOptional()
  @IsString()
  category?: string | undefined;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  tags?: string[] | undefined;

  @IsOptional()
  @IsDateString()
  startDate?: string | undefined;

  @IsOptional()
  @IsDateString()
  endDate?: string | undefined;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number | undefined = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number | undefined = 20;

  @IsOptional()
  @IsEnum(['publishedAt', 'views', 'likes', 'createdAt'])
  sortBy?: 'publishedAt' | 'views' | 'likes' | 'createdAt' | undefined = 'publishedAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' | undefined = 'DESC';
}