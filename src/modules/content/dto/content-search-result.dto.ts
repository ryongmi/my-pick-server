import { Exclude, Expose, Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';
import { ContentMetadata } from '../interfaces/index.js';

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
  description?: string | undefined;

  @Expose()
  thumbnail!: string;

  @Expose()
  url!: string;

  @Expose()
  platform!: string;

  @Expose()
  platformId!: string;

  @Expose()
  duration?: number | undefined;

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

  @Expose()
  metadata!: ContentMetadata;

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