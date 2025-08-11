import { Injectable, Logger } from '@nestjs/common';

import { CacheService } from '@database/redis/cache.service.js';

import { ReportRepository } from '../repositories/index.js';
import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';

@Injectable()
export class ReportStatisticsService {
  private readonly logger = new Logger(ReportStatisticsService.name);

  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.reportRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total report count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async getReportStatistics(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    reportsThisMonth: number;
    reportsByTargetType: Array<{ targetType: ReportTargetType; count: number }>;
    reportsByStatus: Array<{ status: ReportStatus; count: number }>;
    reportsByReason: Array<{ reason: ReportReason; count: number }>;
    reportTrends: Array<{ date: string; count: number }>;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getReportStatistics();
        if (cached && cached.totalReports !== undefined) {
          this.logger.debug('Report statistics cache hit');
          return cached as {
            totalReports: number;
            pendingReports: number;
            resolvedReports: number;
            reportsThisMonth: number;
            reportsByTargetType: Array<{ targetType: ReportTargetType; count: number }>;
            reportsByStatus: Array<{ status: ReportStatus; count: number }>;
            reportsByReason: Array<{ reason: ReportReason; count: number }>;
            reportTrends: Array<{ date: string; count: number }>;
          };
        }

        const [
          totalReports,
          pendingReports,
          resolvedReports,
          reportsThisMonth,
          reportsByTargetType,
          reportsByStatus,
          reportsByReason,
          reportTrends,
        ] = await Promise.all([
          this.reportRepo.getTotalCount(),
          this.reportRepo.getCountByStatus(ReportStatus.PENDING),
          this.reportRepo.getCountByStatus(ReportStatus.RESOLVED),
          this.reportRepo.getReportsThisMonth(),
          this.reportRepo.getReportStatsByTargetType(),
          this.reportRepo.getReportStatsByStatus(),
          this.reportRepo.getReportStatsByReason(),
          this.reportRepo.getReportTrends(30),
        ]);

        const result = {
          totalReports,
          pendingReports,
          resolvedReports,
          reportsThisMonth,
          reportsByTargetType,
          reportsByStatus,
          reportsByReason,
          reportTrends,
        };

        // 결과를 캐시에 저장
        await this.cacheService.setReportStatistics(result);

        this.logger.debug('Report statistics generated and cached', {
          totalReports,
          pendingReports,
          resolvedReports,
          reportsThisMonth,
          targetTypeCount: reportsByTargetType.length,
          statusCount: reportsByStatus.length,
          reasonCount: reportsByReason.length,
          trendDays: reportTrends.length,
        });

        return result;
      },
      'Generate report statistics'
    );
  }

  async getStatusDistribution(): Promise<Array<{ status: ReportStatus; count: number; percentage: number }>> {
    return await this.executeWithErrorHandling(
      async () => {
        // 캐시에서 먼저 조회
        const cached = await this.cacheService.getReportDistribution('status');
        if (cached && Array.isArray(cached)) {
          this.logger.debug('Status distribution cache hit');
          return cached as Array<{ status: ReportStatus; count: number; percentage: number }>;
        }

        const [statusStats, totalReports] = await Promise.all([
          this.reportRepo.getReportStatsByStatus(),
          this.reportRepo.getTotalCount(),
        ]);

        const distribution = statusStats.map(stat => ({
          status: stat.status,
          count: stat.count,
          percentage: totalReports > 0 ? Math.round((stat.count / totalReports) * 100) : 0,
        }));

        // 결과를 캐시에 저장
        await this.cacheService.setReportDistribution('status', distribution as unknown as Record<string, unknown>);

        this.logger.debug('Status distribution calculated and cached', {
          totalReports,
          statusCount: distribution.length,
        });

        return distribution;
      },
      'Get status distribution'
    );
  }

  async getTargetTypeDistribution(): Promise<Array<{ targetType: ReportTargetType; count: number; percentage: number }>> {
    try {
      const [targetTypeStats, totalReports] = await Promise.all([
        this.reportRepo.getReportStatsByTargetType(),
        this.reportRepo.getTotalCount(),
      ]);

      const distribution = targetTypeStats.map(stat => ({
        targetType: stat.targetType,
        count: stat.count,
        percentage: totalReports > 0 ? Math.round((stat.count / totalReports) * 100) : 0,
      }));

      this.logger.debug('Target type distribution calculated', {
        totalReports,
        targetTypeCount: distribution.length,
      });

      return distribution;
    } catch (error: unknown) {
      this.logger.error('Failed to get target type distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  async getReasonDistribution(): Promise<Array<{ reason: ReportReason; count: number; percentage: number }>> {
    try {
      const [reasonStats, totalReports] = await Promise.all([
        this.reportRepo.getReportStatsByReason(),
        this.reportRepo.getTotalCount(),
      ]);

      const distribution = reasonStats.map(stat => ({
        reason: stat.reason,
        count: stat.count,
        percentage: totalReports > 0 ? Math.round((stat.count / totalReports) * 100) : 0,
      }));

      this.logger.debug('Reason distribution calculated', {
        totalReports,
        reasonCount: distribution.length,
      });

      return distribution;
    } catch (error: unknown) {
      this.logger.error('Failed to get reason distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  async getPriorityDistribution(): Promise<Array<{ priority: number; count: number; percentage: number }>> {
    try {
      const priorityStats = await this.reportRepo.getReportStatsByPriority();
      const totalReports = await this.reportRepo.getTotalCount();

      const distribution = priorityStats.map(stat => ({
        priority: stat.priority,
        count: stat.count,
        percentage: totalReports > 0 ? Math.round((stat.count / totalReports) * 100) : 0,
      }));

      this.logger.debug('Priority distribution calculated', {
        totalReports,
        priorityCount: distribution.length,
      });

      return distribution;
    } catch (error: unknown) {
      this.logger.error('Failed to get priority distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  async getMonthlyTrends(months: number = 12): Promise<Array<{ month: string; count: number; resolved: number; pending: number }>> {
    return await this.executeWithErrorHandling(
      async () => {
        // 캐시에서 먼저 조회
        const cacheKey = `monthly-${months}`;
        const cached = await this.cacheService.getReportTrends(cacheKey);
        if (cached && Array.isArray(cached)) {
          this.logger.debug('Monthly trends cache hit', { months });
          return cached as Array<{ month: string; count: number; resolved: number; pending: number }>;
        }

        const monthlyData = await this.reportRepo.getMonthlyReportTrends(months);

        const trends = monthlyData.map(data => ({
          month: data.month,
          count: data.total,
          resolved: data.resolved || 0,
          pending: data.pending || 0,
        }));

        // 결과를 캐시에 저장
        await this.cacheService.setReportTrends(cacheKey, trends as unknown as Record<string, unknown>);

        this.logger.debug('Monthly trends calculated and cached', {
          months,
          trendCount: trends.length,
        });

        return trends;
      },
      'Get monthly trends',
      { months }
    );
  }

  async getTopReportedTargets(limit: number = 10): Promise<Array<{ 
    targetType: ReportTargetType; 
    targetId: string; 
    count: number;
    lastReportedAt: Date;
  }>> {
    try {
      const topTargets = await this.reportRepo.getTopReportedTargets(limit);

      this.logger.debug('Top reported targets retrieved', {
        limit,
        resultCount: topTargets.length,
      });

      return topTargets;
    } catch (error: unknown) {
      this.logger.error('Failed to get top reported targets', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  async getReporterActivityStats(): Promise<{
    totalReporters: number;
    activeReportersThisMonth: number;
    topReporters: Array<{ reporterId: string; reportCount: number; lastReportAt: Date }>;
    averageReportsPerUser: number;
  }> {
    try {
      const [
        totalReporters,
        activeReportersThisMonth,
        topReporters,
        totalReports,
      ] = await Promise.all([
        this.reportRepo.getTotalReportersCount(),
        this.reportRepo.getActiveReportersThisMonth(),
        this.reportRepo.getTopReporters(10),
        this.reportRepo.getTotalCount(),
      ]);

      const averageReportsPerUser = totalReporters > 0 ? Math.round((totalReports / totalReporters) * 100) / 100 : 0;

      this.logger.debug('Reporter activity stats calculated', {
        totalReporters,
        activeReportersThisMonth,
        topReportersCount: topReporters.length,
        averageReportsPerUser,
      });

      return {
        totalReporters,
        activeReportersThisMonth,
        topReporters,
        averageReportsPerUser,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get reporter activity stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  async getResolutionTimeStats(): Promise<{
    averageResolutionTimeHours: number;
    medianResolutionTimeHours: number;
    resolutionTimesByPriority: Array<{ priority: number; averageHours: number }>;
  }> {
    try {
      const [
        averageResolutionTime,
        medianResolutionTime,
        resolutionTimesByPriority,
      ] = await Promise.all([
        this.reportRepo.getAverageResolutionTime(),
        this.reportRepo.getMedianResolutionTime(),
        this.reportRepo.getResolutionTimesByPriority(),
      ]);

      this.logger.debug('Resolution time stats calculated', {
        averageResolutionTimeHours: averageResolutionTime,
        medianResolutionTimeHours: medianResolutionTime,
        priorityStatsCount: resolutionTimesByPriority.length,
      });

      return {
        averageResolutionTimeHours: averageResolutionTime,
        medianResolutionTimeHours: medianResolutionTime,
        resolutionTimesByPriority,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get resolution time stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

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

      throw ReportException.statisticsGenerationError();
    }
  }

  // ==================== 캐시 키 생성 메서드 ====================

  generateStatsCacheKey(statsType: string, params?: Record<string, unknown>): string {
    const baseKey = `report-stats:${statsType}`;
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