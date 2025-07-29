import { Exclude, Expose } from 'class-transformer';

export class AdminDashboardStatsDto {
  @Expose()
  totalUsers: number;

  @Expose()
  totalCreators: number;

  @Expose()
  totalContent: number;

  @Expose()
  totalSubscriptions: number;

  @Expose()
  totalInteractions: number;

  @Expose()
  pendingApplications: number;

  @Expose()
  approvedApplications: number;

  @Expose()
  rejectedApplications: number;
}

export class AdminDashboardMetricsDto {
  @Expose()
  dailyActiveUsers: number;

  @Expose()
  weeklyActiveUsers: number;

  @Expose()
  monthlyActiveUsers: number;

  @Expose()
  dailyNewContent: number;

  @Expose()
  weeklyNewContent: number;

  @Expose()
  monthlyNewContent: number;

  @Expose()
  topCreatorsBySubscribers: Array<{
    creatorId: string;
    name: string;
    subscriberCount: number;
  }>;

  @Expose()
  topContentByViews: Array<{
    contentId: string;
    title: string;
    views: number;
    creatorName: string;
  }>;

  @Expose()
  platformDistribution: Array<{
    platform: string;
    contentCount: number;
    percentage: number;
  }>;

  @Expose()
  categoryDistribution: Array<{
    category: string;
    contentCount: number;
    percentage: number;
  }>;
}

export class AdminDashboardOverviewDto {
  @Expose()
  stats: AdminDashboardStatsDto;

  @Expose()
  metrics: AdminDashboardMetricsDto;

  @Expose()
  recentActivities: Array<{
    type: 'content_created' | 'creator_approved' | 'user_registered' | 'application_submitted';
    description: string;
    timestamp: Date;
    relatedId?: string;
  }>;

  @Expose()
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message?: string;
    }>;
  };
}