import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateContentCategoryDto {
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

class UpdateContentTagDto {
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

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  // ==================== 메타데이터 필드 업데이트 ====================

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

  // ==================== 분리된 엔티티 데이터 업데이트 ====================

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateContentCategoryDto)
  categories?: UpdateContentCategoryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateContentTagDto)
  tags?: UpdateContentTagDto[];
}

export class UpdateContentStatisticsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  views?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  likes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shares?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  engagementRate?: number;
}
