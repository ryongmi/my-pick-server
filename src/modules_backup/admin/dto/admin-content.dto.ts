import { Expose } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsNumber, Min } from 'class-validator';

import { ContentType } from '../../content/enums/index.js';
import { ContentStatus } from '../enums/index.js';

export class AdminContentSearchQueryDto {
  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  search?: string; // 제목이나 설명에서 검색

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['createdAt', 'publishedAt', 'views', 'title'])
  sortBy?: 'createdAt' | 'publishedAt' | 'views' | 'title' = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AdminContentListItemDto {
  @Expose()
  id!: string;

  @Expose()
  type!: ContentType;

  @Expose()
  title!: string;

  @Expose()
  platform!: string;

  @Expose()
  status!: ContentStatus;

  @Expose()
  publishedAt!: Date;

  @Expose()
  createdAt!: Date;

  @Expose()
  creator!: {
    id: string;
    name: string;
    displayName: string;
  };

  @Expose()
  statistics!: {
    views: number;
    likes: number;
    comments: number;
  };

  @Expose()
  flagCount!: number;

  @Expose()
  lastModeratedAt?: Date;

  @Expose()
  moderatedBy?: string;
}

export class AdminContentDetailDto extends AdminContentListItemDto {
  @Expose()
  description?: string;

  @Expose()
  thumbnail!: string;

  @Expose()
  url!: string;

  @Expose()
  platformId!: string;

  @Expose()
  duration?: number;

  @Expose()
  metadata!: Record<string, unknown>;

  @Expose()
  flags!: Array<{
    id: string;
    reason: string;
    description?: string;
    reportedBy: string;
    reportedAt: Date;
    status: 'pending' | 'reviewed' | 'dismissed';
  }>;

  @Expose()
  moderationHistory!: Array<{
    action: 'approved' | 'flagged' | 'removed' | 'restored';
    reason?: string;
    moderatedBy: string;
    moderatedAt: Date;
  }>;
}

export class UpdateContentStatusDto {
  @IsEnum(ContentStatus)
  status!: ContentStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  moderatedBy!: string; // 관리자 ID
}
