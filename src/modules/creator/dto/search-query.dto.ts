import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

import { PaginateBaseDto } from '@krgeobuk/core/dtos';

/**
 * 크리에이터 검색 Query DTO
 */
export class CreatorSearchQueryDto extends PaginateBaseDto {
  @IsOptional()
  @IsString()
  keyword?: string; // 이름 검색

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  activeOnly?: boolean; // 활성화된 크리에이터만

  @IsOptional()
  @IsString()
  userId?: string; // 특정 사용자의 크리에이터만
}
