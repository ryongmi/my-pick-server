import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorPlatformSyncRepository } from '../repositories/index.js';
import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

/**
 * 동기화 프로세스 처리 전용 서비스
 * 실제 동기화 작업의 상태 변경 및 처리 로직 담당
 */
@Injectable()
export class CreatorSyncProcessorService {
  private readonly logger = new Logger(CreatorSyncProcessorService.name);

  constructor(private readonly platformSyncRepo: CreatorPlatformSyncRepository) {}

  // ==================== 동기화 프로세스 메서드 ====================

  /**
   * 영상 동기화 시작
   */
  async startVideoSync(
    platformId: string,
    options: {
      expectedVideoCount?: number;
      isFullSync?: boolean;
      isManual?: boolean;
    } = {},
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const { expectedVideoCount, isFullSync = false, isManual = false } = options;

      const platformSync = await this.platformSyncRepo.findByPlatformId(platformId);

      if (!platformSync) {
        this.logger.warn('Platform sync not found, initializing', { platformId });
        await this.initializePlatformSync(platformId, transactionManager);
        return await this.startVideoSync(platformId, options, transactionManager);
      }

      // 이미 진행 중인 동기화가 있는지 확인
      if (platformSync.videoSyncStatus === VideoSyncStatus.IN_PROGRESS) {
        this.logger.warn('Video sync already in progress', {
          platformId,
          lastSyncAt: platformSync.lastVideoSyncAt,
        });
        return;
      }

      // 동기화 상태 업데이트
      const updateData: Partial<CreatorPlatformSyncEntity> = {
        videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
        lastVideoSyncAt: new Date(),
        syncStartedAt: new Date(),
        syncedVideoCount: 0,
        failedVideoCount: 0,
        lastSyncError: null,
      };

      if (expectedVideoCount !== undefined) {
        updateData.totalVideoCount = expectedVideoCount;
      }

      Object.assign(platformSync, updateData);
      await this.platformSyncRepo.updateEntity(platformSync, transactionManager);

      this.logger.log('Video sync started', {
        platformId,
        expectedVideoCount,
        isFullSync,
        isManual,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to start video sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        options,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncStartError();
    }
  }

  /**
   * 동기화 진행상황 업데이트
   */
  async updateSyncProgress(
    platformId: string,
    progress: {
      syncedCount: number;
      failedCount?: number;
      totalCount?: number;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const { syncedCount, failedCount = 0, totalCount } = progress;

      const updateData: Partial<CreatorPlatformSyncEntity> = {
        syncedVideoCount: syncedCount,
        failedVideoCount: failedCount,
        lastVideoSyncAt: new Date(),
      };

      if (totalCount !== undefined) {
        updateData.totalVideoCount = totalCount;
      }

      const sync = await this.platformSyncRepo.findByPlatformId(platformId);
      if (sync) {
        Object.assign(sync, updateData);
        await this.platformSyncRepo.updateEntity(sync, transactionManager);
      }

      this.logger.debug('Sync progress updated', {
        platformId,
        syncedCount,
        failedCount,
        totalCount,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update sync progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        progress,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncUpdateError();
    }
  }

  /**
   * 영상 동기화 완료
   */
  async completeVideoSync(
    platformId: string,
    summary: {
      totalProcessed: number;
      successCount: number;
      failedCount: number;
      skippedCount?: number;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const { totalProcessed, successCount, failedCount, skippedCount = 0 } = summary;

      const updateData = {
        videoSyncStatus: VideoSyncStatus.COMPLETED,
        syncedVideoCount: successCount,
        failedVideoCount: failedCount,
        totalVideoCount: totalProcessed,
        syncCompletedAt: new Date(),
        lastVideoSyncAt: new Date(),
        lastSyncError: null,
      };

      const sync = await this.platformSyncRepo.findByPlatformId(platformId);
      if (sync) {
        Object.assign(sync, updateData);
        await this.platformSyncRepo.updateEntity(sync, transactionManager);
      }

      this.logger.log('Video sync completed successfully', {
        platformId,
        totalProcessed,
        successCount,
        failedCount,
        skippedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to complete video sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        summary,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncCompleteError();
    }
  }

  /**
   * 영상 동기화 실패 처리
   */
  async failVideoSync(
    platformId: string,
    errorInfo: {
      errorMessage: string;
      partialResults?: {
        syncedCount: number;
        failedCount: number;
      };
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const { errorMessage, partialResults } = errorInfo;

      const updateData: Partial<CreatorPlatformSyncEntity> = {
        videoSyncStatus: VideoSyncStatus.FAILED,
        lastSyncError: errorMessage,
        syncCompletedAt: new Date(),
        lastVideoSyncAt: new Date(),
      };

      if (partialResults) {
        updateData.syncedVideoCount = partialResults.syncedCount;
        updateData.failedVideoCount = partialResults.failedCount;
      }

      const sync = await this.platformSyncRepo.findByPlatformId(platformId);
      if (sync) {
        Object.assign(sync, updateData);
        await this.platformSyncRepo.updateEntity(sync, transactionManager);
      }

      this.logger.error('Video sync failed', {
        platformId,
        errorMessage,
        partialResults,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to mark sync as failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        errorInfo,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncFailError();
    }
  }

  /**
   * 수동 동기화 시작
   */
  async startManualSync(platformId: string): Promise<void> {
    try {
      this.logger.log('Starting manual sync', { platformId });

      await this.startVideoSync(
        platformId,
        {
          isFullSync: true,
          isManual: true,
        }
      );

      this.logger.log('Manual sync initiated', { platformId });
    } catch (error: unknown) {
      this.logger.error('Manual sync initiation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.manualSyncError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 플랫폼 동기화 정보 초기화
   */
  private async initializePlatformSync(
    platformId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    const syncData = {
      platformId,
      videoSyncStatus: VideoSyncStatus.NEVER_SYNCED,
      totalVideoCount: null,
      syncedVideoCount: null,
      failedVideoCount: null,
      lastVideoSyncAt: null,
      syncStartedAt: null,
      syncCompletedAt: null,
      lastSyncError: null,
    };

    const sync = this.platformSyncRepo.create(syncData);
    await this.platformSyncRepo.saveEntity(sync, transactionManager);

    this.logger.debug('Platform sync initialized', { platformId });
  }

  /**
   * 동기화 상태 리셋
   */
  private async resetSync(platformId: string, transactionManager?: EntityManager): Promise<void> {
    const resetData = {
      videoSyncStatus: VideoSyncStatus.NEVER_SYNCED,
      syncedVideoCount: null,
      failedVideoCount: null,
      totalVideoCount: null,
      lastVideoSyncAt: null,
      syncStartedAt: null,
      syncCompletedAt: null,
      lastSyncError: null,
    };

    const sync = await this.platformSyncRepo.findByPlatformId(platformId);
    if (sync) {
      Object.assign(sync, resetData);
      await this.platformSyncRepo.updateEntity(sync, transactionManager);
    }

    this.logger.debug('Sync status reset', { platformId });
  }
}