import { Injectable, Logger } from '@nestjs/common';

import { ContentSyncMetadataRepository } from '../repositories/index.js';
import { ContentSyncMetadataEntity } from '../entities/index.js';

export interface SyncMetricsDto {
  apiCallCount?: number;
  quotaUsed?: number;
  syncDuration?: number;
  dataVersion?: string;
}

export interface QuotaAnalysis {
  contentId: string;
  totalApiCalls: number;
  totalQuotaUsed: number;
  averageSyncDuration: number;
  lastQuotaReset?: Date;
  isQuotaExceeded: boolean;
}

@Injectable()
export class ContentSyncMetadataService {
  private readonly logger = new Logger(ContentSyncMetadataService.name);

  constructor(private readonly contentSyncMetadataRepo: ContentSyncMetadataRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByContentId(contentId: string): Promise<ContentSyncMetadataEntity | null> {
    return this.contentSyncMetadataRepo.findByContentId(contentId);
  }

  async updateSyncMetrics(contentId: string, metrics: SyncMetricsDto): Promise<void> {
    try {
      await this.contentSyncMetadataRepo.updateSyncMetadata(contentId, metrics);

      this.logger.log('Sync metrics updated successfully', {
        contentId,
        apiCallCount: metrics.apiCallCount,
        quotaUsed: metrics.quotaUsed,
        syncDuration: metrics.syncDuration,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update sync metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        metrics,
      });
      throw error;
    }
  }

  async incrementApiCall(contentId: string, quotaUsed: number = 1): Promise<void> {
    try {
      await this.contentSyncMetadataRepo.incrementApiCallCount(contentId, 1);

      // 쿼터 사용량도 함께 업데이트
      const existing = await this.findByContentId(contentId);
      if (existing) {
        await this.contentSyncMetadataRepo.updateSyncMetadata(contentId, {
          quotaUsed: (existing.quotaUsed || 0) + quotaUsed,
        });
      }

      this.logger.debug('API call incremented', {
        contentId,
        quotaUsed,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to increment API call', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        quotaUsed,
      });
      throw error;
    }
  }

  async resetQuota(contentId: string): Promise<void> {
    try {
      await this.contentSyncMetadataRepo.updateSyncMetadata(contentId, {
        apiCallCount: 0,
        quotaUsed: 0,
        lastQuotaReset: new Date(),
      });

      this.logger.log('Quota reset successfully', { contentId });
    } catch (error: unknown) {
      this.logger.error('Failed to reset quota', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw error;
    }
  }

  async getQuotaAnalysis(contentId: string): Promise<QuotaAnalysis | null> {
    try {
      const metadata = await this.findByContentId(contentId);
      if (!metadata) return null;

      const isQuotaExceeded = this.isQuotaExceeded(metadata.quotaUsed || 0);

      const result: any = {
        contentId,
        totalApiCalls: metadata.apiCallCount || 0,
        totalQuotaUsed: metadata.quotaUsed || 0,
        averageSyncDuration: metadata.syncDuration || 0,
        isQuotaExceeded,
      };

      if (metadata.lastQuotaReset) {
        result.lastQuotaReset = metadata.lastQuotaReset;
      }

      return result;
    } catch (error: unknown) {
      this.logger.error('Failed to get quota analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw error;
    }
  }

  async recordSyncPerformance(
    contentId: string,
    startTime: Date,
    endTime: Date,
    apiCallsUsed: number = 1
  ): Promise<void> {
    try {
      const syncDuration = endTime.getTime() - startTime.getTime();

      await this.updateSyncMetrics(contentId, {
        syncDuration,
      });

      await this.incrementApiCall(contentId, apiCallsUsed);

      this.logger.debug('Sync performance recorded', {
        contentId,
        syncDuration,
        apiCallsUsed,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to record sync performance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        syncDuration: endTime.getTime() - startTime.getTime(),
      });
      throw error;
    }
  }

  async updateDataVersion(contentId: string, version: string): Promise<void> {
    try {
      await this.contentSyncMetadataRepo.updateSyncMetadata(contentId, {
        dataVersion: version,
      });

      this.logger.debug('Data version updated', { contentId, version });
    } catch (error: unknown) {
      this.logger.error('Failed to update data version', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        version,
      });
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private isQuotaExceeded(quotaUsed: number): boolean {
    const DAILY_QUOTA_LIMIT = 10000; // YouTube API 기본 할당량 예시
    return quotaUsed >= DAILY_QUOTA_LIMIT;
  }

  private shouldResetQuota(lastQuotaReset?: Date): boolean {
    if (!lastQuotaReset) return true;

    const now = new Date();
    const lastReset = new Date(lastQuotaReset);
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    return hoursSinceReset >= 24; // 24시간마다 쿼터 리셋
  }
}
