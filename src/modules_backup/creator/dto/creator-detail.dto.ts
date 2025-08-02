import { Exclude, Expose, Type } from 'class-transformer';

class CreatorPlatformDetailDto {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  platformId!: string;

  @Expose()
  url!: string;

  @Expose()
  followerCount!: number;

  @Expose()
  contentCount!: number;

  @Expose()
  totalViews!: number;

  @Expose()
  isActive!: boolean;

  @Expose()
  lastSyncAt?: Date;

  @Expose()
  syncStatus!: string;
}

export class CreatorDetailDto {
  @Expose()
  id!: string;

  @Expose()
  userId?: string;

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
  contentCount!: number;

  @Expose()
  totalViews!: number;

  @Expose()
  category!: string;

  @Expose()
  tags?: string[];

  @Expose()
  @Type(() => CreatorPlatformDetailDto)
  platforms!: CreatorPlatformDetailDto[];

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;

  @Expose()
  subscriberCount?: number;

  @Expose()
  isSubscribed?: boolean;
}