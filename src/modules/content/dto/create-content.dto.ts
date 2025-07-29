import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentType, ContentMetadata } from '../entities';

class CreateContentMetadataDto {
  @IsString({ each: true })
  tags: string[];

  @IsString()
  category: string;

  @IsString()
  language: string;

  @IsOptional()
  isLive?: boolean = false;

  @IsEnum(['sd', 'hd', '4k'])
  quality: 'sd' | 'hd' | '4k';

  @IsOptional()
  ageRestriction?: boolean;
}

export class CreateContentDto {
  @IsEnum(ContentType)
  type: ContentType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  thumbnail: string;

  @IsString()
  url: string;

  @IsString()
  platform: string;

  @IsString()
  platformId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsDateString()
  publishedAt: string;

  @IsString()
  creatorId: string;

  @ValidateNested()
  @Type(() => CreateContentMetadataDto)
  metadata: CreateContentMetadataDto;

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
}