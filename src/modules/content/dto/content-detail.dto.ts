import { Expose, Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';

import { ContentCategoryDto } from './content-category.dto.js';
import { ContentTagDto } from './content-tag.dto.js';

class CreatorDetailDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  displayName!: string;

  @Expose()
  avatar?: string;

  @Expose()
  description?: string;

  @Expose()
  isVerified!: boolean;

  @Expose()
  followerCount!: number;

  @Expose()
  category!: string;

  @Expose()
  tags?: string[];
}

class ContentStatisticsDetailDto {
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

export class ContentDetailDto {
  @Expose()
  id!: string;

  @Expose()
  type!: ContentType;

  @Expose()
  title!: string;

  @Expose()
  description?: string;

  @Expose()
  thumbnail!: string;

  @Expose()
  url!: string;

  @Expose()
  platform!: string;

  @Expose()
  platformId!: string;

  @Expose()
  duration?: number;

  @Expose()
  publishedAt!: Date;

  @Expose()
  creatorId!: string;

  @Expose()
  @Type(() => CreatorDetailDto)
  creator!: CreatorDetailDto;

  @Expose()
  @Type(() => ContentStatisticsDetailDto)
  statistics!: ContentStatisticsDetailDto;

  // ==================== 메타데이터 필드 (JSON에서 개별 컬럼으로 분리) ====================

  @Expose()
  language?: string;

  @Expose()
  isLive!: boolean;

  @Expose()
  quality?: 'sd' | 'hd' | '4k';

  @Expose()
  ageRestriction!: boolean;

  @Expose()
  status!: 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed';

  // ==================== 분리된 엔티티 데이터 ====================

  @Expose()
  @Type(() => ContentCategoryDto)
  categories?: ContentCategoryDto[];

  @Expose()
  @Type(() => ContentTagDto)
  tags?: ContentTagDto[];

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  // 사용자별 상호작용 정보 (옵셔널)
  @Expose()
  isBookmarked?: boolean;

  @Expose()
  isLiked?: boolean;

  @Expose()
  watchedAt?: Date;

  @Expose()
  watchDuration?: number;

  @Expose()
  rating?: number;

  // 추가 통계 정보
  @Expose()
  bookmarkCount?: number;

  @Expose()
  likeCount?: number;
}
