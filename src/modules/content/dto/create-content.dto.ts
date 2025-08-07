import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, ValidateNested, Min, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';

class CreateContentCategoryDto {
  @IsString()
  category!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsEnum(['manual', 'ai', 'platform'])
  source?: 'manual' | 'ai' | 'platform';

  @IsOptional()
  @IsNumber()
  @Min(0)
  confidence?: number;
}

class CreateContentTagDto {
  @IsString()
  tag!: string;

  @IsOptional()
  @IsEnum(['manual', 'ai', 'platform'])
  source?: 'manual' | 'ai' | 'platform';

  @IsOptional()
  @IsNumber()
  @Min(0)
  relevanceScore?: number;
}

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  thumbnail!: string;

  @IsString()
  url!: string;

  @IsString()
  platform!: string;

  @IsString()
  platformId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsDateString()
  publishedAt!: string;

  @IsString()
  creatorId!: string;

  // ==================== 메타데이터 필드 (JSON에서 개별 필드로 분리) ====================
  
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

  // ==================== 분리된 엔티티 데이터 ====================
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContentCategoryDto)
  categories?: CreateContentCategoryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContentTagDto)
  tags?: CreateContentTagDto[];

  // 초기 통계 정보 (외부 API에서 가져온 경우)
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialViews?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialLikes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialComments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialShares?: number;

  // 데이터 만료 및 동기화 관련 (external-api에서 사용)
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  lastSyncedAt?: string;

  @IsOptional()
  isAuthorizedData?: boolean;
}