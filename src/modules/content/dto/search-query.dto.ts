import { IsOptional, IsString, IsEnum } from 'class-validator';

import { PaginateBaseDto } from '@krgeobuk/core/dtos';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

/**
 * 콘텐츠 검색 Query DTO
 */
export class ContentSearchQueryDto extends PaginateBaseDto {
  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsEnum(PlatformType)
  platform?: PlatformType;

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
