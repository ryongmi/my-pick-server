import { Injectable, Logger } from '@nestjs/common';

import { CacheService } from '@database/redis/cache.service.js';

import { PlatformApplicationRepository } from '../repositories/index.js';
import { ApplicationStatus, PlatformType } from '../enums/index.js';
import { ApplicationStatsDto } from '../dto/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';

@Injectable()
export class PlatformApplicationStatisticsService {
  private readonly logger = new Logger(PlatformApplicationStatisticsService.name);

  constructor(
    private readonly platformApplyRepo: PlatformApplicationRepository,
    private readonly cacheService: CacheService
  ) {}

  // ==================== 에러 처리 헬퍼 메서드 ====================

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

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  // ==================== PUBLIC METHODS ====================

  async getApplicationStats(): Promise<ApplicationStatsDto> {
    return await this.executeWithErrorHandling(
      async () => {
        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getPlatformApplicationStats();
        if (cached && cached.total !== undefined) {
          this.logger.debug('Platform application stats cache hit');
          return cached as unknown as ApplicationStatsDto;
        }

        const stats = await this.platformApplyRepo.getApplicationStats();
        
        // 결과를 캐시에 저장
        await this.cacheService.setPlatformApplicationStats(stats as unknown as Record<string, unknown>);
        
        this.logger.debug('Platform application stats generated and cached');
        return stats;
      },
      'Get platform application stats'
    );
  }

  async getStatusDistribution(): Promise<Array<{ status: ApplicationStatus; count: number; percentage: number }>> {
    try {
      const [statusStats, totalApplications] = await Promise.all([
        this.getApplicationStatsByStatus(),
        this.getTotalApplicationsCount(),
      ]);

      const distribution = statusStats.map(stat => ({
        status: stat.status,
        count: stat.count,
        percentage: totalApplications > 0 ? Math.round((stat.count / totalApplications) * 100) : 0,
      }));

      this.logger.debug('Status distribution calculated', {
        totalApplications,
        statusCount: distribution.length,
      });

      return distribution;
    } catch (error: unknown) {
      this.logger.error('Failed to get status distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  async getPlatformTypeDistribution(): Promise<Array<{ platformType: PlatformType; count: number; percentage: number }>> {
    try {
      const [platformStats, totalApplications] = await Promise.all([
        this.getApplicationStatsByPlatformType(),
        this.getTotalApplicationsCount(),
      ]);

      const distribution = platformStats.map(stat => ({
        platformType: stat.platformType,
        count: stat.count,
        percentage: totalApplications > 0 ? Math.round((stat.count / totalApplications) * 100) : 0,
      }));

      this.logger.debug('Platform type distribution calculated', {
        totalApplications,
        platformTypeCount: distribution.length,
      });

      return distribution;
    } catch (error: unknown) {
      this.logger.error('Failed to get platform type distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  async getMonthlyApplicationTrends(months: number = 12): Promise<Array<{ month: string; total: number; approved: number; rejected: number; pending: number }>> {
    try {
      const monthlyData = await this.platformApplyRepo.getMonthlyApplicationTrends(months);

      const trends = monthlyData.map(data => ({
        month: data.month,
        total: data.total,
        approved: data.approved || 0,
        rejected: data.rejected || 0,
        pending: data.pending || 0,
      }));

      this.logger.debug('Monthly application trends calculated', {
        months,
        trendCount: trends.length,
      });

      return trends;
    } catch (error: unknown) {
      this.logger.error('Failed to get monthly application trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        months,
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  async getApprovalRateByPlatform(): Promise<Array<{ platformType: PlatformType; totalApplications: number; approvedApplications: number; approvalRate: number }>> {
    try {
      const approvalRateData = await this.platformApplyRepo.getApprovalRateByPlatform();

      const approvalRates = approvalRateData.map(data => ({
        platformType: data.platformType as PlatformType,
        totalApplications: data.totalApplications,
        approvedApplications: data.approvedApplications,
        approvalRate: data.totalApplications > 0 
          ? Math.round((data.approvedApplications / data.totalApplications) * 100)
          : 0,
      }));

      this.logger.debug('Approval rate by platform calculated', {
        platformCount: approvalRates.length,
      });

      return approvalRates;
    } catch (error: unknown) {
      this.logger.error('Failed to get approval rate by platform', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  async getAverageReviewTime(): Promise<number> {
    try {
      const averageTime = await this.platformApplyRepo.getAverageReviewTime();

      this.logger.debug('Average review time calculated', {
        averageHours: averageTime,
      });

      return averageTime;
    } catch (error: unknown) {
      this.logger.error('Failed to get average review time', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  async getTopRejectionReasons(limit: number = 10): Promise<Array<{ reason: string; count: number; percentage: number }>> {
    try {
      const [rejectionReasons, totalRejections] = await Promise.all([
        this.platformApplyRepo.getTopRejectionReasons(limit),
        this.platformApplyRepo.countByStatus(ApplicationStatus.REJECTED),
      ]);

      const topReasons = rejectionReasons.map(reason => ({
        reason: reason.reason,
        count: reason.count,
        percentage: totalRejections > 0 ? Math.round((reason.count / totalRejections) * 100) : 0,
      }));

      this.logger.debug('Top rejection reasons calculated', {
        totalRejections,
        reasonCount: topReasons.length,
      });

      return topReasons;
    } catch (error: unknown) {
      this.logger.error('Failed to get top rejection reasons', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw PlatformApplicationException.statisticsGenerationError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async getTotalApplicationsCount(): Promise<number> {
    return await this.platformApplyRepo.count();
  }

  private async getApplicationStatsByStatus(): Promise<Array<{ status: ApplicationStatus; count: number }>> {
    return await this.platformApplyRepo.getApplicationStatsByStatus();
  }

  private async getApplicationStatsByPlatformType(): Promise<Array<{ platformType: PlatformType; count: number }>> {
    const results = await this.platformApplyRepo.getApplicationStatsByPlatformType();
    return results.map(result => ({
      platformType: result.platformType as PlatformType,
      count: result.count,
    }));
  }

  // ==================== 캐시 키 생성 메서드 ====================

  generateStatsCacheKey(statsType: string, params?: Record<string, unknown>): string {
    const baseKey = `platform-application-stats:${statsType}`;
    if (params) {
      const paramString = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join('|');
      return `${baseKey}:${paramString}`;
    }
    return baseKey;
  }
}