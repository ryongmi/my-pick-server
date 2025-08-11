import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { plainToInstance } from 'class-transformer';

import { LimitType } from '@krgeobuk/core/enum';

import { CacheService } from '@database/redis/cache.service.js';

import { CreatorService } from '../../creator/services/index.js';
import { ContentService, ContentAdminStatisticsService } from '../../content/services/index.js';
import { AdminDashboardMetricsDto } from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';

@Injectable()
export class AdminDashboardMetricsService {
  private readonly logger = new Logger(AdminDashboardMetricsService.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly contentService: ContentService,
    private readonly contentStatisticsService: ContentAdminStatisticsService,
    private readonly cacheService: CacheService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    return await this.executeWithErrorHandling(
      async () => {
        this.logger.debug('Fetching dashboard metrics');

        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getAdminDashboardMetrics();
        if (cached) {
          this.logger.debug('Admin dashboard metrics cache hit');
          return plainToInstance(AdminDashboardMetricsDto, cached, {
            excludeExtraneousValues: true,
          });
        }

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

        const metricsData = {
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
        };

        const metrics = plainToInstance(AdminDashboardMetricsDto, metricsData, {
          excludeExtraneousValues: true,
        });

        // 결과를 캐시에 저장
        await this.cacheService.setAdminDashboardMetrics(metricsData);

        this.logger.debug('Dashboard metrics fetched and cached successfully');
        return metrics;
      },
      'Get dashboard metrics'
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

  private async getActiveUsersFromAuthService(days: number): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        const result = await this.authClient.send('user.getActiveCount', { days }).toPromise();

        this.logger.debug('Active users fetched from auth service', {
          count: result?.count || 0,
          days,
        });

        return result?.count || 0;
      },
      'Get active users from auth service',
      { days },
      0
    );
  }

  private async getTopCreatorsBySubscribers(limit: number): Promise<
    Array<{
      creatorId: string;
      name: string;
      subscriberCount: number;
    }>
  > {
    return await this.executeWithErrorHandling(
      async () => {
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
      },
      'Get top creators by subscribers',
      { limit },
      []
    );
  }

  private async getContentCounts(): Promise<{
    dailyNewContent: number;
    weeklyNewContent: number;
    monthlyNewContent: number;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getNewContentCounts(30);
      },
      'Get content counts',
      {},
      { dailyNewContent: 0, weeklyNewContent: 0, monthlyNewContent: 0 }
    );
  }

  private async getTopContentByViews(limit: number): Promise<
    Array<{
      contentId: string;
      title: string;
      views: number;
      creatorName: string;
    }>
  > {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getTopContentByViews(limit);
      },
      'Get top content by views',
      { limit },
      []
    );
  }

  private async getPlatformDistribution(): Promise<
    Array<{
      platform: string;
      contentCount: number;
      percentage: number;
    }>
  > {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getPlatformDistribution();
      },
      'Get platform distribution',
      {},
      []
    );
  }

  private async getCategoryDistribution(): Promise<
    Array<{
      category: string;
      contentCount: number;
      percentage: number;
    }>
  > {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getCategoryDistribution();
      },
      'Get category distribution',
      {},
      []
    );
  }
}