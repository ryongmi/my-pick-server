import { Expose, Type } from 'class-transformer';

import { ApplicationStatus } from '../enums/index.js';

export class ChannelInfoDto {
  @Expose()
  platform!: string;

  @Expose()
  channelId!: string;

  @Expose()
  channelUrl!: string;

  @Expose()
  subscriberCount!: number;

  @Expose()
  contentCategory!: string;

  @Expose()
  description!: string;
}

export class SampleVideoDto {
  @Expose()
  id!: string;

  @Expose()
  title!: string;

  @Expose()
  url!: string;

  @Expose()
  views!: number;

  @Expose()
  sortOrder!: number;
}

export class ReviewDto {
  @Expose()
  reason?: string;

  @Expose()
  comment?: string;

  @Expose()
  requirements?: string[];
}

export class NormalizedApplicationDetailDto {
  @Expose()
  id!: string;

  @Expose()
  userId!: string;

  @Expose()
  status!: ApplicationStatus;

  @Expose()
  appliedAt!: Date;

  @Expose()
  reviewedAt?: Date;

  @Expose()
  reviewerId?: string;

  @Expose()
  @Type(() => ChannelInfoDto)
  channelInfo?: ChannelInfoDto;

  @Expose()
  @Type(() => SampleVideoDto)
  sampleVideos?: SampleVideoDto[];

  @Expose()
  @Type(() => ReviewDto)
  review?: ReviewDto;
}