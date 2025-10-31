import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

import { PaginateBaseDto } from '@krgeobuk/core/dtos';

/**
 * 크리에이터 검색 Query DTO
 */
export class CreatorSearchQueryDto extends PaginateBaseDto {
  @IsOptional()
  @IsString()
  name?: string; // 이름 검색

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  activeOnly?: boolean; // 활성화된 크리에이터만

  @IsOptional()
  @IsEnum(['youtube', 'twitter'])
  platform?: 'youtube' | 'twitter'; // 플랫폼 필터

  @IsOptional()
  @IsEnum(['followers', 'name', 'content', 'recent'])
  orderBy?: 'followers' | 'name' | 'content' | 'recent'; // 크리에이터 정렬 옵션
}
