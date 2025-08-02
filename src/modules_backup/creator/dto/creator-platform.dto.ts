import { Expose } from 'class-transformer';

export class CreatorPlatformDto {
  @Expose()
  id!: string;

  @Expose()
  type!: string;

  @Expose()
  platformId!: string;

  @Expose()
  url!: string;

  @Expose()
  displayName?: string;

  @Expose()
  followerCount!: number;

  @Expose()
  contentCount!: number;

  @Expose()
  totalViews!: number;

  @Expose()
  isActive!: boolean;

  @Expose()
  lastSyncAt?: Date | undefined;

  @Expose()
  syncStatus!: string;
}