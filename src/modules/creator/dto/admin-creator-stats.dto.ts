import { Expose } from 'class-transformer';

import { CreatorStatsDto } from './creator-stats.dto.js';

export class AdminCreatorStatsDto extends CreatorStatsDto {
  @Expose()
  avgEngagementRate!: number;

  @Expose()
  weeklyGrowth!: number;

  @Expose()
  monthlyGrowth!: number;

  @Expose()
  topContent!: unknown[]; // TODO: 추후 TopContentDto로 대체

  @Expose()
  recentActivity!: unknown[]; // TODO: 추후 RecentActivityDto로 대체
}