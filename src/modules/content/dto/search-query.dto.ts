import { IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

import { PaginateBaseDto } from '@krgeobuk/core/dtos';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

/**
 * 콘텐츠 검색 Query DTO
 */
export class ContentSearchQueryDto extends PaginateBaseDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  })
  creatorIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(PlatformType, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  })
  platforms?: PlatformType[];

  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  // TODO: UserInteraction 기능 추가 시 구현
  // @IsOptional()
  // @IsBoolean()
  // @Transform(({ value }) => value === 'true')
  // bookmarkedOnly?: boolean;

  // @IsOptional()
  // @IsBoolean()
  // @Transform(({ value }) => value === 'true')
  // followedOnly?: boolean;
}
