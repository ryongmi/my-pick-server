import { Expose, Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';

import { ContentCategoryDto } from './content-category.dto.js';
import { ContentTagDto } from './content-tag.dto.js';

class CreatorInfoDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  displayName!: string;

  @Expose()
  avatar?: string | undefined;

  @Expose()
  isVerified!: boolean;
}

class ContentStatisticsDto {
  @Expose()
  views!: number;

  @Expose()
  likes!: number;

  @Expose()
  comments!: number;

  @Expose()
  shares!: number;

  @Expose()
  engagementRate!: number;

  @Expose()
  updatedAt!: Date;
}

export class ContentSearchResultDto {
  @Expose()
  id!: string;

  @Expose()
  type!: ContentType;

  @Expose()
  title!: string;

  @Expose()
  description?: string | null;

  @Expose()
  thumbnail!: string;

  @Expose()
  url!: string;

  @Expose()
  platform!: string;

  @Expose()
  platformId!: string;

  @Expose()
  duration?: number | null;

  @Expose()
  publishedAt!: Date;

  @Expose()
  creatorId!: string;

  @Expose()
  @Type(() => CreatorInfoDto)
  creator?: CreatorInfoDto | undefined;

  @Expose()
  @Type(() => ContentStatisticsDto)
  statistics!: ContentStatisticsDto;

  // ==================== 메타데이터 필드 (JSON에서 개별 컬럼으로 분리) ====================

  @Expose()
  language?: string | null;

  @Expose()
  isLive!: boolean;

  @Expose()
  quality?: 'sd' | 'hd' | '4k' | null;

  @Expose()
  ageRestriction!: boolean;

  @Expose()
  status!: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed';

  // ==================== 분리된 엔티티 데이터 (옵셔널) ====================

  @Expose()
  @Type(() => ContentCategoryDto)
  categories?: ContentCategoryDto[];

  @Expose()
  @Type(() => ContentTagDto)
  tags?: ContentTagDto[];

  @Expose()
  createdAt!: Date;

  // 사용자별 상호작용 정보 (옵셔널)
  @Expose()
  isBookmarked?: boolean | undefined;

  @Expose()
  isLiked?: boolean | undefined;

  @Expose()
  watchedAt?: Date | undefined;

  @Expose()
  rating?: number | undefined;
}
