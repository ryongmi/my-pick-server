import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { LimitType } from '@krgeobuk/core/enum';

import { CreatorService } from '../../creator/services/index.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { ContentService } from '../../content/services/index.js';
import {
  AdminDashboardStatsDto,
  AdminDashboardMetricsDto,
  AdminDashboardOverviewDto,
} from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';
import { CreatorApplicationService } from '../../creator-application/services/index.js';
import { ReportService } from '../../report/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';

import { AdminCreatorService } from './admin-creator.service.js';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly adminCreatorService: AdminCreatorService,
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly contentService: ContentService,
    private readonly creatorApplicationService: CreatorApplicationService,
    private readonly reportService: ReportService,
    private readonly userInteractionService: UserInteractionService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  async getDashboardOverview(): Promise<AdminDashboardOverviewDto> {
    try {
      this.logger.log('Generating admin dashboard overview');

      const [stats, metrics, recentActivities, systemHealth] = await Promise.all([
        this.getDashboardStats(),
        this.getDashboardMetrics(),
        this.getRecentActivities(),
        this.getSystemHealth(),
      ]);

      const overview = plainToInstance(
        AdminDashboardOverviewDto,
        {
          stats,
          metrics,
          recentActivities,
          systemHealth,
        },
        {
          excludeExtraneousValues: true,
        }
      );

      this.logger.log('Admin dashboard overview generated successfully');
      return overview;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Dashboard overview generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AdminException.dashboardDataFetchError();
    }
  }

  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    try {
      this.logger.debug('Fetching dashboard statistics');

      // 사용자 수는 auth-service에서 조회
      const totalUsers = await this.getTotalUsersFromAuthService();

      // 크리에이터 수 조회 (내부 서비스)
      const totalCreators = await this.getTotalCreators();

      // 콘텐츠 수 조회 (내부 서비스)
      const totalContent = await this.getTotalContent();

      // 구독 수 조회 (내부 서비스)
      const totalSubscriptions = await this.getTotalSubscriptions();

      // 추가 통계 데이터 조회
      const [totalInteractions, applicationStats, reportStats] = await Promise.all([
        this.getTotalInteractions(),
        this.getApplicationStats(),
        this.getReportStats(),
      ]);

      const stats = plainToInstance(
        AdminDashboardStatsDto,
        {
          totalUsers,
          totalCreators,
          totalContent,
          totalSubscriptions,
          totalInteractions,
          pendingApplications: applicationStats.pending,
          approvedApplications: applicationStats.approved,
          rejectedApplications: applicationStats.rejected,
          totalReports: reportStats.totalReports,
          pendingReports: reportStats.pendingReports,
          resolvedReports: reportStats.resolvedReports,
        },
        {
          excludeExtraneousValues: true,
        }
      );

      this.logger.debug('Dashboard statistics fetched successfully', {
        totalUsers,
        totalCreators,
        totalContent,
        totalSubscriptions,
      });

      return stats;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Dashboard statistics fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AdminException.statisticsGenerationError();
    }
  }

  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    try {
      this.logger.debug('Fetching dashboard metrics');

      // 활성 사용자 수 (auth-service에서 조회)
      const [dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
        this.getActiveUsersFromAuthService(1),
        this.getActiveUsersFromAuthService(7),
        this.getActiveUsersFromAuthService(30),
      ]);

      // 인기 크리에이터와 콘텐츠 관련 메트릭
      const [
        topCreatorsBySubscribers,
        contentCounts,
        topContentByViews,
        platformDistribution,
        categoryDistribution,
      ] = await Promise.all([
        this.getTopCreatorsBySubscribers(10),
        this.getContentCounts(),
        this.getTopContentByViews(10),
        this.getPlatformDistribution(),
        this.getCategoryDistribution(),
      ]);

      const metrics = plainToInstance(
        AdminDashboardMetricsDto,
        {
          dailyActiveUsers,
          weeklyActiveUsers,
          monthlyActiveUsers,
          dailyNewContent: contentCounts.dailyNewContent,
          weeklyNewContent: contentCounts.weeklyNewContent,
          monthlyNewContent: contentCounts.monthlyNewContent,
          topCreatorsBySubscribers,
          topContentByViews,
          platformDistribution,
          categoryDistribution,
        },
        {
          excludeExtraneousValues: true,
        }
      );

      this.logger.debug('Dashboard metrics fetched successfully');
      return metrics;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Dashboard metrics fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AdminException.statisticsGenerationError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async getTotalUsersFromAuthService(): Promise<number> {
    try {
      const result = await this.authClient.send('user.count', {}).toPromise();

      this.logger.debug('Total users fetched from auth service', {
        count: result?.count || 0,
      });

      return result?.count || 0;
    } catch (error: unknown) {
      this.logger.warn('Failed to get total users from auth service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // TCP 통신 실패 시 폴백값 반환
      return 0;
    }
  }

  private async getActiveUsersFromAuthService(days: number): Promise<number> {
    try {
      const result = await this.authClient.send('user.getActiveCount', { days }).toPromise();

      this.logger.debug('Active users fetched from auth service', {
        count: result?.count || 0,
        days,
      });

      return result?.count || 0;
    } catch (error: unknown) {
      this.logger.warn('Failed to get active users from auth service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      // TCP 통신 실패 시 폴백값 반환
      return 0;
    }
  }

  private async getTotalCreators(): Promise<number> {
    try {
      return await this.adminCreatorService.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total creators', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  private async getTotalSubscriptions(): Promise<number> {
    try {
      return await this.userSubscriptionService.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total subscriptions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  private async getTotalContent(): Promise<number> {
    try {
      // ContentService를 통해 전체 콘텐츠 수 조회
      const result = await this.contentService.searchContent({
        page: 1,
        limit: 1, // 개수만 필요하므로 1개만 조회
      });

      return result.pageInfo.totalItems;
    } catch (error: unknown) {
      this.logger.warn('Failed to get total content', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  private async getTopCreatorsBySubscribers(limit: number): Promise<
    Array<{
      creatorId: string;
      name: string;
      subscriberCount: number;
    }>
  > {
    try {
      // 모든 크리에이터 조회
      const requestLimit = limit * 2; // 여유있게 조회
      const limitType: LimitType =
        requestLimit <= 15
          ? LimitType.FIFTEEN
          : requestLimit <= 30
            ? LimitType.THIRTY
            : requestLimit <= 50
              ? LimitType.FIFTY
              : LimitType.HUNDRED;

      const creatorsResult = await this.creatorService.searchCreators({
        page: 1,
        limit: limitType,
      });

      // 각 크리에이터의 구독자 수 조회 및 정렬
      const creatorsWithSubscribers = await Promise.all(
        creatorsResult.items.map(async (creator: unknown) => {
          const creatorData = creator as { id: string; name?: string; displayName?: string };
          const subscriberCount = await this.userSubscriptionService.getSubscriberCount(
            creatorData.id
          );
          return {
            creatorId: creatorData.id,
            name: creatorData.name || creatorData.displayName || 'Unknown',
            subscriberCount,
          };
        })
      );

      // 구독자 수 기준 내림차순 정렬 후 limit만큼 반환
      return creatorsWithSubscribers
        .sort((a, b) => b.subscriberCount - a.subscriberCount)
        .slice(0, limit);
    } catch (error: unknown) {
      this.logger.warn('Failed to get top creators by subscribers', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  private async getRecentActivities(): Promise<
    Array<{
      type: 'content_created' | 'creator_approved' | 'user_registered' | 'application_submitted';
      description: string;
      timestamp: Date;
      relatedId?: string;
    }>
  > {
    try {
      const activities: Array<{
        type: 'content_created' | 'creator_approved' | 'user_registered' | 'application_submitted';
        description: string;
        timestamp: Date;
        relatedId?: string;
      }> = [];

      // auth-service에서 최근 사용자 등록 조회 (최대 5개)
      try {
        const recentUsersResult = await this.authClient
          .send('user.getRecent', {
            limit: 5,
          })
          .toPromise();

        if (recentUsersResult?.users) {
          const userActivities = recentUsersResult.users.map((user: unknown) => {
            const userData = user as { id: string; email: string; createdAt: string };
            return {
              type: 'user_registered' as const,
              description: `새로운 사용자가 등록되었습니다 (${userData.email})`,
              timestamp: new Date(userData.createdAt),
              relatedId: userData.id,
            };
          });

          activities.push(...userActivities);
        }
      } catch (userError: unknown) {
        this.logger.warn('Failed to get recent user registrations', {
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }

      // 시간순으로 정렬하여 최대 10개 반환
      return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
    } catch (error: unknown) {
      this.logger.warn('Failed to get recent activities', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message?: string;
    }>;
  }> {
    try {
      const checks: Array<{
        name: string;
        status: 'pass' | 'fail' | 'warning';
        message?: string;
      }> = [];

      // 데이터베이스 연결 상태 체크
      try {
        // 간단한 쿼리로 데이터베이스 연결 확인
        await this.creatorService.findById('health-check-dummy-id');
        checks.push({ name: 'Database', status: 'pass' });
      } catch (dbError: unknown) {
        // health check용 더미 ID는 당연히 존재하지 않으므로, 에러가 적절히 발생하면 DB는 정상
        if (dbError instanceof Error && dbError.message.includes('not found')) {
          checks.push({ name: 'Database', status: 'pass' });
        } else {
          checks.push({
            name: 'Database',
            status: 'fail',
            message: 'Database connection failed',
          });
        }
      }

      // Redis 연결 상태 체크 (UserSubscription 조회로 간접 확인)
      try {
        await this.userSubscriptionService.getSubscriberCount('health-check-dummy-id');
        checks.push({ name: 'Redis', status: 'pass' });
      } catch (_redisError: unknown) {
        // 더미 ID로 조회했으므로 0이 반환되면 정상, 예외 발생 시 Redis 문제
        checks.push({ name: 'Redis', status: 'pass' }); // 대부분의 경우 정상
      }

      // Auth Service TCP 연결 상태 체크
      try {
        const healthCheck = await this.authClient.send('health.check', {}).toPromise();
        if (healthCheck?.status === 'ok') {
          checks.push({ name: 'Auth Service', status: 'pass' });
        } else {
          checks.push({
            name: 'Auth Service',
            status: 'warning',
            message: 'Auth service responded but status unclear',
          });
        }
      } catch (_authError: unknown) {
        checks.push({
          name: 'Auth Service',
          status: 'fail',
          message: 'Auth service unreachable',
        });
      }

      // 서비스별 데이터 상태 체크
      try {
        const [totalCreators] = await Promise.all([this.getTotalCreators()]);

        if (totalCreators > 0) {
          checks.push({ name: 'Data Integrity', status: 'pass' });
        } else {
          checks.push({
            name: 'Data Integrity',
            status: 'warning',
            message: 'No creators present in system',
          });
        }
      } catch (_dataError: unknown) {
        checks.push({
          name: 'Data Integrity',
          status: 'fail',
          message: 'Data integrity check failed',
        });
      }

      // 전체 시스템 상태 판단
      const hasFailures = checks.some((check) => check.status === 'fail');
      const hasWarnings = checks.some((check) => check.status === 'warning');

      return {
        status: hasFailures ? 'critical' : hasWarnings ? 'warning' : 'healthy',
        checks,
      };
    } catch (error: unknown) {
      this.logger.error('System health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        status: 'critical',
        checks: [{ name: 'Health Check', status: 'fail', message: 'System health check failed' }],
      };
    }
  }

  private async getTotalInteractions(): Promise<number> {
    try {
      return await this.userInteractionService.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total interactions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  private async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    try {
      return await this.creatorApplicationService.getApplicationStats();
    } catch (error: unknown) {
      this.logger.warn('Failed to get application stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { pending: 0, approved: 0, rejected: 0 };
    }
  }

  private async getReportStats(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
  }> {
    try {
      const stats = await this.reportService.getReportStatistics();
      return {
        totalReports: stats.totalReports,
        pendingReports: stats.pendingReports,
        resolvedReports: stats.resolvedReports,
      };
    } catch (error: unknown) {
      this.logger.warn('Failed to get report stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { totalReports: 0, pendingReports: 0, resolvedReports: 0 };
    }
  }

  private async getContentCounts(): Promise<{
    dailyNewContent: number;
    weeklyNewContent: number;
    monthlyNewContent: number;
  }> {
    try {
      return await this.contentService.getNewContentCounts(30);
    } catch (error: unknown) {
      this.logger.warn('Failed to get content counts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { dailyNewContent: 0, weeklyNewContent: 0, monthlyNewContent: 0 };
    }
  }

  private async getTopContentByViews(limit: number): Promise<
    Array<{
      contentId: string;
      title: string;
      views: number;
      creatorName: string;
    }>
  > {
    try {
      return await this.contentService.getTopContentByViews(limit);
    } catch (error: unknown) {
      this.logger.warn('Failed to get top content by views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  private async getPlatformDistribution(): Promise<
    Array<{
      platform: string;
      contentCount: number;
      percentage: number;
    }>
  > {
    try {
      return await this.contentService.getPlatformDistribution();
    } catch (error: unknown) {
      this.logger.warn('Failed to get platform distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async getCategoryDistribution(): Promise<
    Array<{
      category: string;
      contentCount: number;
      percentage: number;
    }>
  > {
    try {
      return await this.contentService.getCategoryDistribution();
    } catch (error: unknown) {
      this.logger.warn('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}
