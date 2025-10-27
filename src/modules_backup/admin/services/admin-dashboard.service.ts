import { Injectable, Logger, HttpException } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { CacheService } from '@database/redis/cache.service.js';

import { AdminDashboardOverviewDto, AdminDashboardStatsDto, AdminDashboardMetricsDto } from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';

import { AdminDashboardStatsService } from './admin-dashboard-stats.service.js';
import { AdminDashboardMetricsService } from './admin-dashboard-metrics.service.js';
import { AdminDashboardHealthService } from './admin-dashboard-health.service.js';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    private readonly dashboardStatsService: AdminDashboardStatsService,
    private readonly dashboardMetricsService: AdminDashboardMetricsService,
    private readonly dashboardHealthService: AdminDashboardHealthService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async getDashboardOverview(): Promise<AdminDashboardOverviewDto> {
    return await this.executeWithErrorHandling(
      async () => {
        this.logger.log('Generating admin dashboard overview');

        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getAdminDashboardOverview();
        if (cached) {
          this.logger.debug('Admin dashboard overview cache hit');
          return plainToInstance(AdminDashboardOverviewDto, cached, {
            excludeExtraneousValues: true,
          });
        }

        const [stats, metrics, recentActivities, systemHealth] = await Promise.all([
          this.dashboardStatsService.getDashboardStats(),
          this.dashboardMetricsService.getDashboardMetrics(),
          this.dashboardHealthService.getRecentActivities(),
          this.dashboardHealthService.getSystemHealth(),
        ]);

        const overviewData = {
          stats,
          metrics,
          recentActivities,
          systemHealth,
        };

        const overview = plainToInstance(AdminDashboardOverviewDto, overviewData, {
          excludeExtraneousValues: true,
        });

        // 결과를 캐시에 저장
        await this.cacheService.setAdminDashboardOverview(overviewData);

        this.logger.log('Admin dashboard overview generated and cached successfully');
        return overview;
      },
      'Generate dashboard overview'
    );
  }

  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return await this.dashboardStatsService.getDashboardStats();
  }

  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    return await this.dashboardMetricsService.getDashboardMetrics();
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

      throw AdminException.dashboardDataFetchError();
    }
  }
}
