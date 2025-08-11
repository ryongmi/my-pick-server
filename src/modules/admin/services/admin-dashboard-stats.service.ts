import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { CacheService } from '@database/redis/cache.service.js';

import { ContentService, ContentOrchestrationService } from '../../content/services/index.js';
import { AdminDashboardStatsDto } from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';
import { CreatorApplicationStatisticsService } from '../../creator-application/services/index.js';
import { ReportService, ReportStatisticsService } from '../../report/services/index.js';
import { UserInteractionService } from '../../user-interaction/services/index.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';

import { AdminCreatorService } from './admin-creator.service.js';

@Injectable()
export class AdminDashboardStatsService {
  private readonly logger = new Logger(AdminDashboardStatsService.name);

  constructor(
    private readonly adminCreatorService: AdminCreatorService,
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly contentService: ContentService,
    private readonly contentOrchestrationService: ContentOrchestrationService,
    private readonly creatorApplicationStatisticsService: CreatorApplicationStatisticsService,
    private readonly reportService: ReportService,
    private readonly reportStatisticsService: ReportStatisticsService,
    private readonly userInteractionService: UserInteractionService,
    private readonly cacheService: CacheService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return await this.executeWithErrorHandling(
      async () => {
        this.logger.debug('Fetching dashboard statistics');

        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getAdminDashboardStats();
        if (cached) {
          this.logger.debug('Admin dashboard stats cache hit');
          return plainToInstance(AdminDashboardStatsDto, cached, {
            excludeExtraneousValues: true,
          });
        }

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

        const statsData = {
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
        };

        const stats = plainToInstance(AdminDashboardStatsDto, statsData, {
          excludeExtraneousValues: true,
        });

        // 결과를 캐시에 저장
        await this.cacheService.setAdminDashboardStats(statsData);

        this.logger.debug('Dashboard statistics fetched and cached successfully', {
          totalUsers,
          totalCreators,
          totalContent,
          totalSubscriptions,
        });

        return stats;
      },
      'Get dashboard stats'
    );
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      throw AdminException.statisticsGenerationError();
    }
  }

  private async getTotalUsersFromAuthService(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        const result = await this.authClient.send('user.count', {}).toPromise();

        this.logger.debug('Total users fetched from auth service', {
          count: result?.count || 0,
        });

        return result?.count || 0;
      },
      'Get total users from auth service',
      {},
      0
    );
  }

  private async getTotalCreators(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.adminCreatorService.getTotalCount();
      },
      'Get total creators',
      {},
      0
    );
  }

  private async getTotalSubscriptions(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.userSubscriptionService.getTotalCount();
      },
      'Get total subscriptions',
      {},
      0
    );
  }

  private async getTotalContent(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        // ContentService를 통해 전체 콘텐츠 수 조회
        const result = await this.contentOrchestrationService.searchContent({
          page: 1,
          limit: 1, // 개수만 필요하므로 1개만 조회
        });

        return result.pageInfo.totalItems;
      },
      'Get total content',
      {},
      0
    );
  }

  private async getTotalInteractions(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.userInteractionService.getTotalCount();
      },
      'Get total interactions',
      {},
      0
    );
  }

  private async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.creatorApplicationStatisticsService.getApplicationStats();
      },
      'Get application stats',
      {},
      { 
        pending: 0, 
        approved: 0, 
        rejected: 0, 
        total: 0, 
        approvalRate: 0, 
        rejectionRate: 0, 
        avgProcessingDays: 0 
      }
    );
  }

  private async getReportStats(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        const stats = await this.reportStatisticsService.getReportStatistics();
        return {
          totalReports: stats.totalReports,
          pendingReports: stats.pendingReports,
          resolvedReports: stats.resolvedReports,
        };
      },
      'Get report stats',
      {},
      { totalReports: 0, pendingReports: 0, resolvedReports: 0 }
    );
  }
}