import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { CreatorService } from '../../creator/services/index.js';
import { ContentService } from '../../content/services/index.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';
import { CreatorApplicationService } from '../../creator-application/services/index.js';
import {
  AdminDashboardStatsDto,
  AdminDashboardMetricsDto,
  AdminDashboardOverviewDto,
} from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';
import { ApplicationStatus } from '../../creator-application/enums/index.js';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly contentService: ContentService,
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly userInteractionService: UserInteractionService,
    private readonly creatorApplicationService: CreatorApplicationService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
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

      const overview = plainToInstance(AdminDashboardOverviewDto, {
        stats,
        metrics,
        recentActivities,
        systemHealth,
      }, {
        excludeExtraneousValues: true,
      });

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

      // 상호작용 수 조회 (내부 서비스)
      const totalInteractions = await this.getTotalInteractions();

      // 크리에이터 신청 통계
      const applicationStats = await this.creatorApplicationService.getApplicationStats();

      const stats = plainToInstance(AdminDashboardStatsDto, {
        totalUsers,
        totalCreators,
        totalContent,
        totalSubscriptions,
        totalInteractions,
        pendingApplications: applicationStats.pending,
        approvedApplications: applicationStats.approved,
        rejectedApplications: applicationStats.rejected,
      }, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Dashboard statistics fetched successfully', {
        totalUsers,
        totalCreators,
        totalContent,
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

      // 새 콘텐츠 수
      const [dailyNewContent, weeklyNewContent, monthlyNewContent] = await Promise.all([
        this.getNewContentCount(1),
        this.getNewContentCount(7),
        this.getNewContentCount(30),
      ]);

      // 인기 크리에이터 및 콘텐츠
      const [topCreatorsBySubscribers, topContentByViews] = await Promise.all([
        this.getTopCreatorsBySubscribers(10),
        this.getTopContentByViews(10),
      ]);

      // 플랫폼 및 카테고리 분포
      const [platformDistribution, categoryDistribution] = await Promise.all([
        this.getPlatformDistribution(),
        this.getCategoryDistribution(),
      ]);

      const metrics = plainToInstance(AdminDashboardMetricsDto, {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        dailyNewContent,
        weeklyNewContent,
        monthlyNewContent,
        topCreatorsBySubscribers,
        topContentByViews,
        platformDistribution,
        categoryDistribution,
      }, {
        excludeExtraneousValues: true,
      });

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
      // TODO: auth-service TCP 통신으로 활성 사용자 수 조회
      // const result = await this.authClient.send('user.getActiveCount', { days }).toPromise();
      // return result.count;
      
      // 임시 반환값
      return Math.floor(1000 * Math.random() * 0.3);
    } catch (error: unknown) {
      this.logger.warn('Failed to get active users from auth service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      return 0;
    }
  }

  private async getTotalCreators(): Promise<number> {
    try {
      return await this.creatorService.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total creators', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  private async getTotalContent(): Promise<number> {
    try {
      return await this.contentService.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total content', {
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

  private async getNewContentCount(days: number): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const searchResult = await this.contentService.searchContent({
        startDate: startDate.toISOString(),
        page: 1,
        limit: 15,
      });

      return searchResult.pageInfo.totalItems;
    } catch (error: unknown) {
      this.logger.warn('Failed to get new content count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      return 0;
    }
  }

  private async getTopCreatorsBySubscribers(limit: number): Promise<Array<{
    creatorId: string;
    name: string;
    subscriberCount: number;
  }>> {
    try {
      // TODO: 구독자 수 기준 상위 크리에이터 조회 구현
      // const topCreators = await this.creatorService.getTopBySubscribers(limit);
      
      // 임시 반환값
      return [];
    } catch (error: unknown) {
      this.logger.warn('Failed to get top creators by subscribers', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  private async getTopContentByViews(limit: number): Promise<Array<{
    contentId: string;
    title: string;
    views: number;
    creatorName: string;
  }>> {
    try {
      // TODO: 조회수 기준 상위 콘텐츠 조회 구현
      // const topContent = await this.contentService.getTopByViews(limit);
      
      // 임시 반환값
      return [];
    } catch (error: unknown) {
      this.logger.warn('Failed to get top content by views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  private async getPlatformDistribution(): Promise<Array<{
    platform: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      // TODO: 플랫폼별 콘텐츠 분포 조회 구현
      // const distribution = await this.contentService.getPlatformDistribution();
      
      // 임시 반환값
      return [
        { platform: 'youtube', contentCount: 1500, percentage: 60 },
        { platform: 'twitter', contentCount: 750, percentage: 30 },
        { platform: 'instagram', contentCount: 250, percentage: 10 },
      ];
    } catch (error: unknown) {
      this.logger.warn('Failed to get platform distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async getCategoryDistribution(): Promise<Array<{
    category: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      // TODO: 카테고리별 콘텐츠 분포 조회 구현
      // const distribution = await this.contentService.getCategoryDistribution();
      
      // 임시 반환값
      return [
        { category: 'entertainment', contentCount: 800, percentage: 32 },
        { category: 'gaming', contentCount: 600, percentage: 24 },
        { category: 'tech', contentCount: 500, percentage: 20 },
        { category: 'music', contentCount: 350, percentage: 14 },
        { category: 'education', contentCount: 250, percentage: 10 },
      ];
    } catch (error: unknown) {
      this.logger.warn('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async getRecentActivities(): Promise<Array<{
    type: 'content_created' | 'creator_approved' | 'user_registered' | 'application_submitted';
    description: string;
    timestamp: Date;
    relatedId?: string;
  }>> {
    try {
      // TODO: 최근 활동 조회 구현
      // 각 서비스에서 최근 이벤트들을 수집하여 통합
      
      // 임시 반환값
      const now = new Date();
      return [
        {
          type: 'content_created',
          description: '새로운 YouTube 동영상이 추가되었습니다',
          timestamp: new Date(now.getTime() - 1000 * 60 * 10), // 10분 전
          relatedId: 'content-123',
        },
        {
          type: 'creator_approved',
          description: '새로운 크리에이터가 승인되었습니다',
          timestamp: new Date(now.getTime() - 1000 * 60 * 30), // 30분 전
          relatedId: 'creator-456',
        },
        {
          type: 'application_submitted',
          description: '새로운 크리에이터 신청이 제출되었습니다',
          timestamp: new Date(now.getTime() - 1000 * 60 * 60), // 1시간 전
          relatedId: 'application-789',
        },
      ];
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
      // TODO: 실제 시스템 상태 체크 구현
      // - 데이터베이스 연결 상태
      // - Redis 연결 상태
      // - 외부 API 상태
      // - 서버 리소스 상태
      
      // 임시 반환값
      const checks = [
        { name: 'Database', status: 'pass' as const },
        { name: 'Redis', status: 'pass' as const },
        { name: 'Auth Service', status: 'pass' as const },
        { name: 'External APIs', status: 'warning' as const, message: 'Twitter API rate limit near threshold' },
      ];

      const hasFailures = false; // Mock data, no failures currently
      const hasWarnings = checks.some(check => check.status === 'warning');

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
        checks: [
          { name: 'Health Check', status: 'fail', message: 'System health check failed' },
        ],
      };
    }
  }
}