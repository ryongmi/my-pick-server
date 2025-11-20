import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

import { SwaggerApiProperty } from '@krgeobuk/swagger';
import { PaginateBaseDto } from '@krgeobuk/core/dtos';

import { PlatformType } from '../enums/creator-platform.enum.js';

/**
 * 크리에이터 검색 Query DTO
 */
export class CreatorSearchQueryDto extends PaginateBaseDto {
  @SwaggerApiProperty({
    description: '크리에이터 이름 검색 키워드',
    example: 'Ado',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @SwaggerApiProperty({
    description: '활성화된 크리에이터만 조회 여부',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  activeOnly?: boolean;

  @SwaggerApiProperty({
    description: '플랫폼 필터 (youtube 또는 twitter)',
    enum: PlatformType,
    example: PlatformType.YOUTUBE,
    required: false,
  })
  @IsOptional()
  @IsEnum(PlatformType)
  platform?: PlatformType;

  @SwaggerApiProperty({
    description:
      '정렬 기준 (followers: 팔로워순, name: 이름순, content: 콘텐츠수, recent: 최근 업데이트)',
    enum: ['followers', 'name', 'content', 'recent'],
    example: 'followers',
    required: false,
  })
  @IsOptional()
  @IsEnum(['followers', 'name', 'content', 'recent'])
  orderBy?: 'followers' | 'name' | 'content' | 'recent';
}
