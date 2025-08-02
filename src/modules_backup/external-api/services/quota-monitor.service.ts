import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, Between, LessThan } from 'typeorm';

import { ApiQuotaUsageEntity } from '../entities/index.js';
import { ApiProvider, ApiOperation } from '../enums/index.js';

interface QuotaConfig {
  youtube: {
    dailyLimit: number;
    warningThreshold: number; // 경고 임계값 (예: 80%)
    criticalThreshold: number; // 위험 임계값 (예: 95%)
    operations: Record<string, number>; // 작업별 쿼터 비용
  };
  twitter: {
    dailyLimit: number;
    warningThreshold: number;
    criticalThreshold: number;
    operations: Record<string, number>;
  };
}

@Injectable()
export class QuotaMonitorService {
  private readonly logger = new Logger(QuotaMonitorService.name);

  // YouTube API 기본 쿼터 설정
  private readonly quotaConfig: QuotaConfig = {
    youtube: {
      dailyLimit: 10000, // YouTube Data API v3 기본 일일 쿼터
      warningThreshold: 0.8, // 80%
      criticalThreshold: 0.95, // 95%
      operations: {
        channels: 1, // 채널 정보 조회
        playlistItems: 1, // 플레이리스트 아이템 조회
        videos: 1, // 비디오 정보 조회 (50개까지 1 유닛)
        search: 100, // 검색 (사용 안함)
      },
    },
    twitter: {
      dailyLimit: 300, // Twitter API v2 기본 일일 한도 (요청 수)
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
      operations: {
        'users/by/username': 1,
        'users/:id/tweets': 1,
      },
    },
  };

  constructor(
    @InjectRepository(ApiQuotaUsageEntity)
    private readonly quotaUsageRepo: Repository<ApiQuotaUsageEntity>
  ) {}

  // ==================== 쿼터 사용량 기록 ====================

  /**
   * API 호출 시 쿼터 사용량 기록
   */
  async recordQuotaUsage(
    apiProvider: ApiProvider,
    operation: ApiOperation,
    quotaUnits?: number,
    requestDetails?: Record<string, unknown>,
    responseStatus?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      // 작업별 기본 쿼터 단위 사용
      const units = quotaUnits || this.quotaConfig[apiProvider].operations[operation] || 1;

      const usage = new ApiQuotaUsageEntity();
      usage.apiProvider = apiProvider;
      usage.operation = operation;
      usage.quotaUnits = units;
      usage.requestDetails = requestDetails ? JSON.stringify(requestDetails) : '';
      usage.responseStatus = responseStatus || '';
      usage.errorMessage = errorMessage || '';
      // date 필드 제거 - createdAt에서 날짜 추출

      await this.quotaUsageRepo.save(usage);

      this.logger.debug('Quota usage recorded', {
        apiProvider,
        operation,
        quotaUnits: units,
        responseStatus,
        hasError: !!errorMessage,
      });

      // 실시간 쿼터 체크 - 현재 날짜로 체크
      const dateStr = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD
      await this.checkQuotaThresholds(apiProvider, dateStr);
    } catch (error: unknown) {
      this.logger.error('Failed to record quota usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiProvider,
        operation,
        quotaUnits,
      });
      // 쿼터 기록 실패가 메인 프로세스를 중단하지 않도록 함
    }
  }

  // ==================== 쿼터 현황 조회 ====================

  /**
   * 일별 쿼터 사용량 조회
   */
  async getDailyQuotaUsage(
    apiProvider: ApiProvider,
    date?: string
  ): Promise<{
    date: string;
    totalUnits: number;
    totalRequests: number;
    usagePercentage: number;
    operationBreakdown: Record<string, { requests: number; units: number }>;
    errorCount: number;
    warningLevel: 'safe' | 'warning' | 'critical';
  }> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0]!;

      // createdAt 기준으로 날짜 필터링
      const startDate = new Date(targetDate + 'T00:00:00.000Z');
      const endDate = new Date(targetDate + 'T23:59:59.999Z');

      const usages = await this.quotaUsageRepo.find({
        where: {
          apiProvider,
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'DESC' },
      });

      const totalUnits = usages.reduce((sum, usage) => sum + usage.quotaUnits, 0);
      const totalRequests = usages.length;
      const errorCount = usages.filter((usage) => usage.errorMessage).length;

      const dailyLimit = this.quotaConfig[apiProvider].dailyLimit;
      const usagePercentage = (totalUnits / dailyLimit) * 100;

      // 작업별 통계
      const operationBreakdown: Record<string, { requests: number; units: number }> = {};
      usages.forEach((usage) => {
        if (!operationBreakdown[usage.operation]) {
          operationBreakdown[usage.operation] = { requests: 0, units: 0 };
        }
        operationBreakdown[usage.operation]!.requests++;
        operationBreakdown[usage.operation]!.units += usage.quotaUnits;
      });

      // 경고 레벨 결정
      let warningLevel: 'safe' | 'warning' | 'critical' = 'safe';
      if (usagePercentage >= this.quotaConfig[apiProvider].criticalThreshold * 100) {
        warningLevel = 'critical';
      } else if (usagePercentage >= this.quotaConfig[apiProvider].warningThreshold * 100) {
        warningLevel = 'warning';
      }

      this.logger.debug('Daily quota usage calculated', {
        apiProvider,
        date: targetDate,
        totalUnits,
        totalRequests,
        usagePercentage: usagePercentage.toFixed(1) + '%',
        warningLevel,
        errorCount,
      });

      return {
        date: targetDate,
        totalUnits,
        totalRequests,
        usagePercentage,
        operationBreakdown,
        errorCount,
        warningLevel,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get daily quota usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiProvider,
        date,
      });
      throw error;
    }
  }

  /**
   * 주간 쿼터 사용량 트렌드 조회
   */
  async getWeeklyQuotaTrend(apiProvider: ApiProvider): Promise<
    Array<{
      date: string;
      totalUnits: number;
      totalRequests: number;
      usagePercentage: number;
      errorCount: number;
    }>
  > {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const usages = await this.quotaUsageRepo.find({
        where: {
          apiProvider,
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'ASC' },
      });

      // 날짜별로 그룹화 - createdAt에서 날짜 추출
      interface DailyStat {
        date: string;
        totalUnits: number;
        totalRequests: number;
        errorCount: number;
        usagePercentage?: number;
      }

      const dailyStats: Record<string, DailyStat> = {};
      const dailyLimit = this.quotaConfig[apiProvider].dailyLimit;

      usages.forEach((usage) => {
        // createdAt에서 YYYY-MM-DD 형식으로 날짜 추출
        const dateKey = usage.createdAt.toISOString().split('T')[0]!;

        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            date: dateKey,
            totalUnits: 0,
            totalRequests: 0,
            errorCount: 0,
          };
        }

        dailyStats[dateKey].totalUnits += usage.quotaUnits;
        dailyStats[dateKey].totalRequests++;
        if (usage.errorMessage) {
          dailyStats[dateKey].errorCount++;
        }
      });

      // 사용률 계산 및 정렬
      const trendData = Object.values(dailyStats)
        .map((day) => ({
          ...day,
          usagePercentage: (day.totalUnits / dailyLimit) * 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      this.logger.debug('Weekly quota trend calculated', {
        apiProvider,
        daysWithData: trendData.length,
        totalDays: 7,
      });

      return trendData;
    } catch (error: unknown) {
      this.logger.error('Failed to get weekly quota trend', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiProvider,
      });
      throw error;
    }
  }

  // ==================== 쿼터 임계값 체크 ====================

  /**
   * 쿼터 임계값 체크 및 경고
   */
  private async checkQuotaThresholds(
    apiProvider: ApiProvider,
    date: string
  ): Promise<void> {
    try {
      const usage = await this.getDailyQuotaUsage(apiProvider, date);

      if (usage.warningLevel === 'critical') {
        this.logger.error('CRITICAL: API quota usage exceeded critical threshold', {
          apiProvider,
          date,
          usagePercentage: usage.usagePercentage.toFixed(1) + '%',
          totalUnits: usage.totalUnits,
          dailyLimit: this.quotaConfig[apiProvider].dailyLimit,
          remainingUnits: this.quotaConfig[apiProvider].dailyLimit - usage.totalUnits,
        });
      } else if (usage.warningLevel === 'warning') {
        this.logger.warn('WARNING: API quota usage exceeded warning threshold', {
          apiProvider,
          date,
          usagePercentage: usage.usagePercentage.toFixed(1) + '%',
          totalUnits: usage.totalUnits,
          dailyLimit: this.quotaConfig[apiProvider].dailyLimit,
          remainingUnits: this.quotaConfig[apiProvider].dailyLimit - usage.totalUnits,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to check quota thresholds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiProvider,
        date,
      });
    }
  }

  /**
   * 쿼터 사용 가능 여부 체크
   */
  async canUseQuota(
    apiProvider: ApiProvider,
    requiredUnits: number = 1
  ): Promise<{
    canUse: boolean;
    currentUsage: number;
    remainingQuota: number;
    usagePercentage: number;
    estimatedHoursUntilReset: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0]!;
      const usage = await this.getDailyQuotaUsage(apiProvider, today);

      const dailyLimit = this.quotaConfig[apiProvider].dailyLimit;
      const remainingQuota = dailyLimit - usage.totalUnits;
      const canUse = remainingQuota >= requiredUnits;

      // 다음 리셋까지 시간 계산 (자정까지)
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const estimatedHoursUntilReset = (midnight.getTime() - now.getTime()) / (1000 * 60 * 60);

      this.logger.debug('Quota availability checked', {
        apiProvider,
        requiredUnits,
        canUse,
        currentUsage: usage.totalUnits,
        remainingQuota,
        usagePercentage: usage.usagePercentage.toFixed(1) + '%',
        estimatedHoursUntilReset: estimatedHoursUntilReset.toFixed(1),
      });

      return {
        canUse,
        currentUsage: usage.totalUnits,
        remainingQuota,
        usagePercentage: usage.usagePercentage,
        estimatedHoursUntilReset,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to check quota availability', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiProvider,
        requiredUnits,
      });

      // 에러 시에는 안전하게 사용 불가로 처리
      return {
        canUse: false,
        currentUsage: 0,
        remainingQuota: 0,
        usagePercentage: 100,
        estimatedHoursUntilReset: 24,
      };
    }
  }

  // ==================== 정리 및 유지보수 ====================

  /**
   * 오래된 쿼터 사용량 기록 정리 (30일 이상)
   */
  async cleanupOldQuotaRecords(): Promise<{ deletedCount: number }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleteResult = await this.quotaUsageRepo.delete({
        createdAt: LessThan(thirtyDaysAgo),
      });

      const deletedCount = deleteResult.affected || 0;

      this.logger.log('Old quota records cleaned up', {
        deletedCount,
        cutoffDate: thirtyDaysAgo.toISOString(),
      });

      return { deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup old quota records', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 쿼터 사용량 요약 통계
   */
  async getQuotaSummary(): Promise<{
    youtube: {
      dailyUsage: number;
      dailyLimit: number;
      usagePercentage: number;
      remainingQuota: number;
      canUse: boolean;
      totalUnits: number;
      totalRequests: number;
      errorCount: number;
      warningLevel: 'safe' | 'warning' | 'critical';
    } | null;
    twitter: {
      dailyUsage: number;
      dailyLimit: number;
      usagePercentage: number;
      remainingQuota: number;
      canUse: boolean;
      totalUnits: number;
      totalRequests: number;
      errorCount: number;
      warningLevel: 'safe' | 'warning' | 'critical';
    } | null;
    totalRecords: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0]!;

      const [youtubeUsage, twitterUsage, totalRecords] = await Promise.all([
        this.getDailyQuotaUsage(ApiProvider.YOUTUBE, today).catch(() => null),
        this.getDailyQuotaUsage(ApiProvider.TWITTER, today).catch(() => null),
        this.quotaUsageRepo.count(),
      ]);

      return {
        youtube: youtubeUsage
          ? {
              dailyUsage: youtubeUsage.totalUnits,
              dailyLimit: this.quotaConfig.youtube.dailyLimit,
              usagePercentage: youtubeUsage.usagePercentage,
              remainingQuota: this.quotaConfig.youtube.dailyLimit - youtubeUsage.totalUnits,
              canUse: youtubeUsage.warningLevel !== 'critical',
              totalUnits: youtubeUsage.totalUnits,
              totalRequests: youtubeUsage.totalRequests,
              errorCount: youtubeUsage.errorCount,
              warningLevel: youtubeUsage.warningLevel,
            }
          : null,
        twitter: twitterUsage
          ? {
              dailyUsage: twitterUsage.totalUnits,
              dailyLimit: this.quotaConfig.twitter.dailyLimit,
              usagePercentage: twitterUsage.usagePercentage,
              remainingQuota: this.quotaConfig.twitter.dailyLimit - twitterUsage.totalUnits,
              canUse: twitterUsage.warningLevel !== 'critical',
              totalUnits: twitterUsage.totalUnits,
              totalRequests: twitterUsage.totalRequests,
              errorCount: twitterUsage.errorCount,
              warningLevel: twitterUsage.warningLevel,
            }
          : null,
        totalRecords,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get quota summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

