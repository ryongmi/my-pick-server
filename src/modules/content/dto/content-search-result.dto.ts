import { Exclude, Expose, Type } from 'class-transformer';
import { ContentType, ContentMetadata } from '../entities';

class CreatorInfoDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  displayName: string;

  @Expose()
  avatar?: string;

  @Expose()
  isVerified: boolean;
}

class ContentStatisticsDto {
  @Expose()
  views: number;

  @Expose()
  likes: number;

  @Expose()
  comments: number;

  @Expose()
  shares: number;

  @Expose()
  engagementRate: number;

  @Expose()
  updatedAt: Date;
}

export class ContentSearchResultDto {
  @Expose()
  id: string;

  @Expose()
  type: ContentType;

  @Expose()
  title: string;

  @Expose()
  description?: string;

  @Expose()
  thumbnail: string;

  @Expose()
  url: string;

  @Expose()
  platform: string;

  @Expose()
  platformId: string;

  @Expose()
  duration?: number;

  @Expose()
  publishedAt: Date;

  @Expose()
  creatorId: string;

  @Expose()
  @Type(() => CreatorInfoDto)
  creator?: CreatorInfoDto | null;

  @Expose()
  @Type(() => ContentStatisticsDto)
  statistics: ContentStatisticsDto;

  @Expose()
  metadata: ContentMetadata;

  @Expose()
  createdAt: Date;

  // 사용자별 상호작용 정보 (옵셔널)
  @Expose()
  isBookmarked?: boolean;

  @Expose()
  isLiked?: boolean;

  @Expose()
  watchedAt?: Date;

  @Expose()
  rating?: number;
}