import { Injectable, Logger, HttpException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { CreatorPlatformSyncRepository } from '../repositories/index.js';
import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';
import { VideoSyncStatus } from '@common/enums/index.js';

/**
 * 영상 동기화 전용 서비스
 * CreatorPlatform의 영상 동기화 작업만을 담당
 */
@Injectable()
export class CreatorPlatformSyncService {
  private readonly logger = new Logger(CreatorPlatformSyncService.name);

  constructor(private readonly platformSyncRepo: CreatorPlatformSyncRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByPlatformId(platformId: string): Promise<CreatorPlatformSyncEntity | null> {
    try {
      return await this.platformSyncRepo.findByPlatformId(platformId);
    } catch (error: unknown) {
      this.logger.error('Platform sync findByPlatformId failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.platformSyncFetchError();
    }
  }

  async findByPlatformIdOrFail(platformId: string): Promise<CreatorPlatformSyncEntity> {
    const syncEntity = await this.findByPlatformId(platformId);
    if (!syncEntity) {
      this.logger.warn('Platform sync not found', { platformId });
      throw CreatorException.platformSyncNotFound();
    }
    return syncEntity;
  }

  async findByPlatformIds(platformIds: string[]): Promise<CreatorPlatformSyncEntity[]> {
    if (platformIds.length === 0) return [];

    try {
      return await this.platformSyncRepo.findByPlatformIds(platformIds);
    } catch (error: unknown) {
      this.logger.error('Platform sync findByPlatformIds failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });
      throw CreatorException.platformSyncFetchError();
    }
  }

  // ==================== 동기화 상태 관리 ====================

  async startVideoSync(
    platformId: string,
    totalVideoCount?: number,
    transactionManager?: EntityManager
  ): Promise<CreatorPlatformSyncEntity> {
    try {
      let syncEntity = await this.findByPlatformId(platformId);

      if (!syncEntity) {
        // 동기화 정보가 없으면 새로 생성
        syncEntity = new CreatorPlatformSyncEntity();
        syncEntity.platformId = platformId;
      }

      // 동기화 시작 상태로 업데이트
      syncEntity.videoSyncStatus = VideoSyncStatus.IN_PROGRESS;
      syncEntity.syncStartedAt = new Date();
      syncEntity.lastVideoSyncAt = new Date();
      syncEntity.lastSyncError = undefined; // 이전 에러 클리어

      if (totalVideoCount !== undefined) {
        syncEntity.totalVideoCount = totalVideoCount;
      }

      // 카운터 초기화 (새로운 동기화 시작)
      syncEntity.syncedVideoCount = 0;
      syncEntity.failedVideoCount = 0;

      const result = await this.platformSyncRepo.saveEntity(syncEntity, transactionManager);

      this.logger.log('Video sync started', {
        platformId,
        totalVideoCount: syncEntity.totalVideoCount,
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Video sync start failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        totalVideoCount,
      });

      throw CreatorException.platformSyncUpdateError();
    }
  }

  async updateSyncProgress(
    platformId: string,
    syncedCount: number,
    failedCount: number,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      syncEntity.syncedVideoCount = syncedCount;
      syncEntity.failedVideoCount = failedCount;
      syncEntity.lastVideoSyncAt = new Date();

      await this.platformSyncRepo.updateEntity(syncEntity, transactionManager);

      this.logger.debug('Sync progress updated', {
        platformId,
        syncedCount,
        failedCount,
        progress: syncEntity.getSyncProgress(),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Sync progress update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        syncedCount,
        failedCount,
      });

      throw CreatorException.platformSyncUpdateError();
    }
  }

  async completeVideoSync(
    platformId: string,
    finalSyncedCount: number,
    finalFailedCount: number,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      syncEntity.videoSyncStatus = VideoSyncStatus.COMPLETED;
      syncEntity.syncCompletedAt = new Date();
      syncEntity.lastVideoSyncAt = new Date();
      syncEntity.syncedVideoCount = finalSyncedCount;
      syncEntity.failedVideoCount = finalFailedCount;
      syncEntity.lastSyncError = undefined; // 성공 시 에러 클리어

      await this.platformSyncRepo.updateEntity(syncEntity, transactionManager);

      this.logger.log('Video sync completed', {
        platformId,
        finalSyncedCount,
        finalFailedCount,
        successRate: syncEntity.getSyncSuccessRate(),
        progress: syncEntity.getSyncProgress(),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Video sync completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        finalSyncedCount,
        finalFailedCount,
      });

      throw CreatorException.platformSyncUpdateError();
    }
  }

  async failVideoSync(
    platformId: string,
    errorMessage: string,
    partialSyncedCount?: number,
    partialFailedCount?: number,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      syncEntity.videoSyncStatus = VideoSyncStatus.FAILED;
      syncEntity.lastVideoSyncAt = new Date();
      syncEntity.lastSyncError = errorMessage;

      if (partialSyncedCount !== undefined) {
        syncEntity.syncedVideoCount = partialSyncedCount;
      }
      if (partialFailedCount !== undefined) {
        syncEntity.failedVideoCount = partialFailedCount;
      }

      await this.platformSyncRepo.updateEntity(syncEntity, transactionManager);

      this.logger.warn('Video sync failed', {
        platformId,
        errorMessage,
        partialSyncedCount,
        partialFailedCount,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Video sync failure recording failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        errorMessage,
      });

      throw CreatorException.platformSyncUpdateError();
    }
  }

  // ==================== 조회 및 통계 메서드 ====================

  async getInProgressSyncs(): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findInProgressSyncs();
    } catch (error: unknown) {
      this.logger.error('Get in-progress syncs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformSyncFetchError();
    }
  }

  async getFailedSyncs(): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findFailedSyncs();
    } catch (error: unknown) {
      this.logger.error('Get failed syncs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformSyncFetchError();
    }
  }

  async getStaleSyncs(hoursAgo: number = 24): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findStaleSync(hoursAgo);
    } catch (error: unknown) {
      this.logger.error('Get stale syncs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo,
      });
      throw CreatorException.platformSyncFetchError();
    }
  }

  async getSyncStatusCounts(): Promise<Record<VideoSyncStatus, number>> {
    try {
      return await this.platformSyncRepo.getStatusCounts();
    } catch (error: unknown) {
      this.logger.error('Get sync status counts failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        [VideoSyncStatus.NEVER_SYNCED]: 0,
        [VideoSyncStatus.IN_PROGRESS]: 0,
        [VideoSyncStatus.COMPLETED]: 0,
        [VideoSyncStatus.FAILED]: 0,
      };
    }
  }

  async getSyncProgressStats(): Promise<{
    totalPlatforms: number;
    totalVideos: number;
    syncedVideos: number;
    failedVideos: number;
    overallProgress: number;
    overallSuccessRate: number;
  }> {
    try {
      return await this.platformSyncRepo.getSyncProgressStats();
    } catch (error: unknown) {
      this.logger.error('Get sync progress stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalPlatforms: 0,
        totalVideos: 0,
        syncedVideos: 0,
        failedVideos: 0,
        overallProgress: 0,
        overallSuccessRate: 0,
      };
    }
  }

  // ==================== 유틸리티 메서드 ====================

  async initializePlatformSync(
    platformId: string,
    transactionManager?: EntityManager
  ): Promise<CreatorPlatformSyncEntity> {
    try {
      // 기존 동기화 정보가 있는지 확인
      const existingSync = await this.findByPlatformId(platformId);
      if (existingSync) {
        this.logger.debug('Platform sync already exists', { platformId });
        return existingSync;
      }

      // 새로운 동기화 정보 생성
      const syncEntity = new CreatorPlatformSyncEntity();
      syncEntity.platformId = platformId;
      syncEntity.videoSyncStatus = VideoSyncStatus.NEVER_SYNCED;

      const result = await this.platformSyncRepo.saveEntity(syncEntity, transactionManager);

      this.logger.log('Platform sync initialized', { platformId });
      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform sync initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncCreateError();
    }
  }

  async resetSync(platformId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      syncEntity.videoSyncStatus = VideoSyncStatus.NEVER_SYNCED;
      syncEntity.syncStartedAt = undefined;
      syncEntity.syncCompletedAt = undefined;
      syncEntity.lastVideoSyncAt = undefined;
      syncEntity.totalVideoCount = undefined;
      syncEntity.syncedVideoCount = undefined;
      syncEntity.failedVideoCount = undefined;
      syncEntity.lastSyncError = undefined;
      syncEntity.syncMetadata = undefined;

      await this.platformSyncRepo.updateEntity(syncEntity, transactionManager);

      this.logger.log('Platform sync reset', { platformId });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform sync reset failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncUpdateError();
    }
  }
}
