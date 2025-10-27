import { Expose } from 'class-transformer';

export class CreatorStatsDto {
  @Expose()
  subscriberCount!: number;

  @Expose()
  followerCount!: number;

  @Expose()
  contentCount!: number;

  @Expose()
  totalViews!: number;
}
