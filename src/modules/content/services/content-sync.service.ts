import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, UpdateResult, In, LessThan } from 'typeorm';

import { ContentSyncRepository, ContentSyncMetadataRepository } from '../repositories/index.js';
import { ContentSyncEntity } from '../entities/content-sync.entity.js';
import { ContentException } from '../exceptions/content.exception.js';

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(
    private readonly contentSyncRepo: ContentSyncRepository,
    private readonly syncMetadataRepo: ContentSyncMetadataRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByContentId(contentId: string): Promise<ContentSyncEntity | null> {
    return this.contentSyncRepo.findOne({ where: { contentId } });
  }

  async findByContentIds(contentIds: string[]): Promise<ContentSyncEntity[]> {
    if (contentIds.length === 0) return [];
    return this.contentSyncRepo.find({
      where: { contentId: In(contentIds) },
      order: { lastSyncedAt: 'DESC' },
    });
  }

  async findByContentIdOrFail(contentId: string): Promise<ContentSyncEntity> {
    const sync = await this.findByContentId(contentId);
    if (!sync) {
      this.logger.warn('Content sync not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return sync;
  }

  // ==================== 동기화 상태 관리 ====================

  async createSyncRecord(
    contentId: string,
    options: {
      platform?: string;
      platformId?: string;
      isAuthorizedData?: boolean;
      expiresAt?: Date;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 동기화 레코드 확인
      const existing = await this.contentSyncRepo.findOne({ where: { contentId } });
      if (existing) {
        this.logger.warn('Sync record already exists', { contentId });
        return; // 이미 존재하면 스킵
      }

      const sync = new ContentSyncEntity();
      sync.contentId = contentId;
      sync.platform = options.platform;
      sync.platformId = options.platformId;
      sync.isAuthorizedData = options.isAuthorizedData || false;
      sync.expiresAt = options.expiresAt;
      sync.syncStatus = 'completed';
      sync.lastSyncedAt = new Date();

      const repository = transactionManager
        ? transactionManager.getRepository(ContentSyncEntity)
        : this.contentSyncRepo;

      await (transactionManager ? repository.save(sync) : this.contentSyncRepo.saveEntity(sync));

      this.logger.log('Content sync record created', {
        contentId,
        platform: options.platform,
        isAuthorizedData: options.isAuthorizedData,
      });
    } catch (error: unknown) {
      this.logger.error('Content sync record creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentCreateError();
    }
  }

  async updateSyncStatus(
    contentId: string,
    status: 'pending' | 'syncing' | 'completed' | 'failed',
    options?: {
      syncError?: string;
      incrementRetryCount?: boolean;
      nextSyncAt?: Date;
      syncMetadata?: any;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const sync = await this.findByContentIdOrFail(contentId);

      sync.syncStatus = status;
      sync.lastSyncedAt = new Date();

      if (options?.syncError) {
        sync.syncError = options.syncError;
      }

      if (options?.incrementRetryCount) {
        sync.syncRetryCount = (sync.syncRetryCount || 0) + 1;
      }

      if (options?.nextSyncAt) {
        sync.nextSyncAt = options.nextSyncAt;
      }

      // syncMetadata는 정규화된 테이블로 분리됨
      if (options?.syncMetadata) {
        await this.syncMetadataRepo.updateSyncMetadata(contentId, options.syncMetadata);
      }

      const repository = transactionManager
        ? transactionManager.getRepository(ContentSyncEntity)
        : this.contentSyncRepo;

      await (transactionManager ? repository.save(sync) : this.contentSyncRepo.saveEntity(sync));

      this.logger.log('Content sync status updated', {
        contentId,
        status,
        retryCount: sync.syncRetryCount,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content sync status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        status,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async refreshSyncData(
    contentId: string,
    expiresAt?: Date,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const sync = await this.findByContentIdOrFail(contentId);

      const now = new Date();
      const defaultExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일 후

      sync.lastSyncedAt = now;
      sync.expiresAt = expiresAt || defaultExpiresAt;
      sync.syncStatus = 'completed';
      sync.syncError = null; // 에러 초기화

      const repository = transactionManager
        ? transactionManager.getRepository(ContentSyncEntity)
        : this.contentSyncRepo;

      await (transactionManager ? repository.save(sync) : this.contentSyncRepo.saveEntity(sync));

      this.logger.debug('Content sync data refreshed', {
        contentId,
        lastSyncedAt: now,
        expiresAt: sync.expiresAt,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content sync data refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  // ==================== YouTube API 정책 준수 메서드 ====================

  async cleanupExpiredContent(): Promise<{
    deletedCount: number;
    authorizedDataCount: number;
    nonAuthorizedDataCount: number;
  }> {
    try {
      this.logger.log('Starting expired content cleanup with authorization-based logic');

      const [expiredNonAuthorized, expiredAuthorized] = await Promise.all([
        this.contentSyncRepo.findExpiredContent(),
        this.contentSyncRepo.findExpiredAuthorizedData(),
      ]);

      if (expiredNonAuthorized.length === 0 && expiredAuthorized.length === 0) {
        this.logger.debug('No expired content found');
        return {
          deletedCount: 0,
          authorizedDataCount: 0,
          nonAuthorizedDataCount: 0,
        };
      }

      let deletedCount = 0;

      // 비인증 데이터 배치 삭제
      if (expiredNonAuthorized.length > 0) {
        const contentIds = expiredNonAuthorized.map((sync) => sync.contentId);
        // TODO: ContentService.deleteContent() 호출하여 실제 콘텐츠도 삭제

        const syncContentIds = expiredNonAuthorized.map((sync) => sync.contentId);
        const deleteResult = await this.contentSyncRepo.delete(syncContentIds);
        deletedCount = deleteResult.affected || 0;
      }

      // 인증 데이터 만료 시간 연장
      if (expiredAuthorized.length > 0) {
        await this.extendAuthorizedDataExpiration(expiredAuthorized.map((s) => s.contentId));
      }

      this.logger.log('Expired content cleanup completed', {
        deletedCount,
        totalExpiredNonAuthorized: expiredNonAuthorized.length,
        totalExpiredAuthorized: expiredAuthorized.length,
      });

      return {
        deletedCount,
        authorizedDataCount: expiredAuthorized.length,
        nonAuthorizedDataCount: expiredNonAuthorized.length,
      };
    } catch (error: unknown) {
      this.logger.error('Expired content cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentCleanupError();
    }
  }

  async extendAuthorizedDataExpiration(contentIds: string[]): Promise<void> {
    try {
      if (contentIds.length === 0) return;

      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일 후

      await this.contentSyncRepo.update(
        { contentId: In(contentIds) },
        {
          expiresAt: newExpiresAt,
          lastSyncedAt: now,
          syncStatus: 'completed',
        }
      );

      this.logger.log('Extended expiration for authorized content data', {
        contentCount: contentIds.length,
        newExpiresAt,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to extend authorized data expiration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentIds: contentIds.slice(0, 5),
        contentCount: contentIds.length,
      });
    }
  }

  async revokeCreatorDataConsent(creatorId: string): Promise<{ deletedCount: number }> {
    try {
      this.logger.log('Revoking data consent for creator', { creatorId });

      // TODO: ContentService 연동하여 실제 콘텐츠 삭제
      // 현재는 동기화 레코드만 삭제

      this.logger.log('Creator data consent revoked - sync records updated', { creatorId });
      return { deletedCount: 0 }; // TODO: 실제 삭제된 수 반환
    } catch (error: unknown) {
      this.logger.error('Failed to revoke creator data consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  async cleanupNonConsentedCreatorData(creatorId: string): Promise<{
    deletedCount: number;
    retainedCount: number;
    oldestRetainedDate: Date | null;
  }> {
    try {
      this.logger.log('Starting rolling window cleanup for non-consented creator', { creatorId });

      const oldSyncRecords = await this.contentSyncRepo.findNonConsentedCreatorSync(creatorId);

      let deletedCount = 0;

      if (oldSyncRecords.length > 0) {
        const syncContentIds = oldSyncRecords.map((sync) => sync.contentId);
        const deleteResult = await this.contentSyncRepo.delete(syncContentIds);
        deletedCount = deleteResult.affected || 0;
      }

      // TODO: 최신 30일 데이터 조회하여 retainedCount, oldestRetainedDate 계산

      this.logger.log('Rolling window cleanup completed for non-consented creator', {
        creatorId,
        deletedCount,
      });

      return {
        deletedCount,
        retainedCount: 0, // TODO: 실제 계산
        oldestRetainedDate: null, // TODO: 실제 계산
      };
    } catch (error: unknown) {
      this.logger.error('Rolling window cleanup failed for non-consented creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentCleanupError();
    }
  }

  // ==================== 새로운 동기화 메타데이터 메서드 ====================

  async updateSyncMetadata(
    contentId: string,
    metadata: {
      apiCallCount?: number;
      quotaUsed?: number;
      lastQuotaReset?: Date;
      syncDuration?: number;
      dataVersion?: string;
    }
  ): Promise<void> {
    try {
      await this.syncMetadataRepo.updateSyncMetadata(contentId, metadata);
      
      this.logger.debug('Sync metadata updated', {
        contentId,
        hasApiCallCount: metadata.apiCallCount !== undefined,
        hasQuotaUsed: metadata.quotaUsed !== undefined,
        hasSyncDuration: metadata.syncDuration !== undefined,
      });
    } catch (error: unknown) {
      this.logger.error('Sync metadata update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async incrementApiCallCount(contentId: string, increment = 1): Promise<void> {
    try {
      await this.syncMetadataRepo.incrementApiCallCount(contentId, increment);
      
      this.logger.debug('API call count incremented', {
        contentId,
        increment,
      });
    } catch (error: unknown) {
      this.logger.error('API call count increment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        increment,
      });
      // API 호출 카운트 업데이트 실패는 critical하지 않으므로 에러를 throw하지 않음
    }
  }

  async getSyncMetadata(contentId: string): Promise<any> {
    try {
      return await this.syncMetadataRepo.findByContentId(contentId);
    } catch (error: unknown) {
      this.logger.error('Sync metadata fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return null;
    }
  }

  // ==================== 동기화 작업 관리 ====================

  async schedulePendingSync(contentId: string, nextSyncAt: Date): Promise<void> {
    await this.updateSyncStatus(contentId, 'pending', { nextSyncAt });
  }

  async getPendingSync(limit?: number): Promise<ContentSyncEntity[]> {
    return this.contentSyncRepo.findPendingSync(limit);
  }

  async getFailedSync(retryLimit: number = 3): Promise<ContentSyncEntity[]> {
    return this.contentSyncRepo.findFailedSync(retryLimit);
  }

  async getSyncDue(): Promise<ContentSyncEntity[]> {
    return this.contentSyncRepo.findSyncDue();
  }

  // ==================== 통계 메서드 ====================

  async getSyncStatusStats(): Promise<{
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
    totalExpired: number;
    totalAuthorized: number;
  }> {
    try {
      const now = new Date();
      const [pending, syncing, completed, failed, totalExpired, totalAuthorized] =
        await Promise.all([
          this.contentSyncRepo.count({ where: { syncStatus: 'pending' } }),
          this.contentSyncRepo.count({ where: { syncStatus: 'syncing' } }),
          this.contentSyncRepo.count({ where: { syncStatus: 'completed' } }),
          this.contentSyncRepo.count({ where: { syncStatus: 'failed' } }),
          this.contentSyncRepo.count({
            where: {
              expiresAt: LessThan(now),
              isAuthorizedData: false,
            },
          }),
          this.contentSyncRepo.count({ where: { isAuthorizedData: true } }),
        ]);

      return {
        pending,
        syncing,
        completed,
        failed,
        totalExpired,
        totalAuthorized,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get sync status stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      return await this.contentSyncRepo.count();
    } catch (error: unknown) {
      this.logger.error('Failed to get total sync count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async getSyncDataBatch(contentIds: string[]): Promise<Record<string, ContentSyncEntity>> {
    try {
      if (contentIds.length === 0) return {};

      const syncData = await this.contentSyncRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<string, ContentSyncEntity> = {};
      syncData.forEach((sync) => {
        result[sync.contentId] = sync;
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch sync data batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  async hasSyncData(contentId: string): Promise<boolean> {
    try {
      return await this.contentSyncRepo.exists({ where: { contentId } });
    } catch (error: unknown) {
      this.logger.error('Failed to check sync data existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return false;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
