import { IsOptional, IsString, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

import { SwaggerApiProperty } from '@krgeobuk/swagger';
import { PaginateBaseDto } from '@krgeobuk/core/dtos';

import { PlatformType } from '@common/enums/index.js';

import { ContentType } from '../enums/index.js';

/**
 * 콘텐츠 검색 Query DTO
 */
export class ContentSearchQueryDto extends PaginateBaseDto {
  @SwaggerApiProperty({
    description: '크리에이터 ID 목록 (쉼표로 구분)',
    example: ['ado', 'yoasobi'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  })
  creatorIds?: string[];

  @SwaggerApiProperty({
    description: '플랫폼 필터 (youtube, twitter)',
    enum: PlatformType,
    example: [PlatformType.YOUTUBE],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PlatformType, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  })
  platforms?: PlatformType[];

  @SwaggerApiProperty({
    description: '콘텐츠 타입 필터',
    enum: ContentType,
    example: ContentType.YOUTUBE_VIDEO,
    required: false,
  })
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @SwaggerApiProperty({
    description:
      '모든 상태의 콘텐츠 포함 여부 (true: 모든 상태, false: ACTIVE만) - 크리에이터 본인 콘텐츠 조회 시만 사용',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAllStatuses?: boolean;

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
