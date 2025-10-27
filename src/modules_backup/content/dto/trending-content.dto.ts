import { Expose, Type } from 'class-transformer';

import { ContentType } from '../enums/index.js';

class TrendingCreatorInfoDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  displayName!: string;

  @Expose()
  avatar?: string;

  @Expose()
  isVerified!: boolean;
}

class TrendingStatisticsDto {
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
}

export class TrendingContentDto {
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
  @Type(() => TrendingCreatorInfoDto)
  creator?: TrendingCreatorInfoDto;

  @Expose()
  @Type(() => TrendingStatisticsDto)
  statistics?: TrendingStatisticsDto;

  @Expose()
  language?: string;

  @Expose()
  isLive!: boolean;

  @Expose()
  quality?: 'sd' | 'hd' | '4k';

  @Expose()
  ageRestriction!: boolean;

  @Expose()
  createdAt!: Date;
}