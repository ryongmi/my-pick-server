import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { LimitType, SortOrderType, SortByBaseType } from '@krgeobuk/core/enum';

export class CreatorSearchQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isVerified?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: LimitType = LimitType.FIFTEEN;

  @IsOptional()
  @IsEnum(['name', 'followerCount', 'createdAt'])
  sortBy?: 'name' | 'followerCount' | 'createdAt' = SortByBaseType.CREATED_AT;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: SortOrderType = SortOrderType.DESC;
}

