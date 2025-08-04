import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorPlatformSyncRepository, type SyncStats } from '../repositories/index.js';
import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

/**
 * 영상 동기화 전용 서비스
 * CreatorPlatform의 영상 동기화 작업만을 담당
 */
@Injectable()
export class CreatorPlatformSyncService {
  private readonly logger = new Logger(CreatorPlatformSyncService.name);

  constructor(private readonly platformSyncRepo: CreatorPlatformSyncRepository) {}

  // ==================== 단순 조회 메서드 (BaseRepository 직접 사용) ====================

  async findByPlatformId(platformId: string): Promise<CreatorPlatformSyncEntity | null> {
    try {
      return await this.platformSyncRepo.findOne({ where: { platformId } });
    } catch (error: unknown) {
      this.logger.error('Platform sync fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.platformFetchError();
    }
  }

  async findByPlatformIdOrFail(platformId: string): Promise<CreatorPlatformSyncEntity> {
    const syncEntity = await this.findByPlatformId(platformId);
    if (!syncEntity) {
      this.logger.debug('Platform sync not found', { platformId });
      throw CreatorException.platformNotFound();
    }
    return syncEntity;
  }

  /**
   * 동기화 진행 상태 확인 (BaseRepository 직접 사용)
   */
  async isInProgress(platformId: string): Promise<boolean> {
    try {
      const sync = await this.platformSyncRepo.findOne({
        where: { platformId, videoSyncStatus: VideoSyncStatus.IN_PROGRESS },
      });
      return !!sync;
    } catch (error: unknown) {
      this.logger.error('Sync progress check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      return false; // 에러 시 안전하게 false 반환
    }
  }

  /**
   * 동기화 진행률 조회 (BaseRepository 직접 사용)
   */
  async getSyncProgress(platformId: string): Promise<number> {
    try {
      const sync = await this.findByPlatformId(platformId);
      return sync ? sync.getSyncProgress() : 0;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch sync progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      return 0;
    }
  }

  // ==================== 배치 처리 메서드 (Repository 사용) ====================

  /**
   * 여러 플랫폼의 동기화 정보 조회 (배치 처리)
   */
  async findByPlatformIds(
    platformIds: string[]
  ): Promise<Record<string, CreatorPlatformSyncEntity | null>> {
    try {
      return await this.platformSyncRepo.findByPlatformIds(platformIds);
    } catch (error: unknown) {
      this.logger.error('Platform sync batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 여러 플랫폼의 진행률 조회 (배치 처리)
   */
  async getSyncProgressBatch(platformIds: string[]): Promise<
    Array<{
      platformId: string;
      progressPercentage: number;
      estimatedTimeRemaining?: number;
    }>
  > {
    try {
      const syncMap = await this.findByPlatformIds(platformIds);
      const result: Array<{
        platformId: string;
        progressPercentage: number;
        estimatedTimeRemaining?: number;
      }> = [];

      Object.entries(syncMap).forEach(([platformId, sync]) => {
        const progressPercentage = sync ? sync.getSyncProgress() : 0;

        // 남은 시간 추정 (진행률이 0이 아닐 때만)
        let estimatedTimeRemaining: number | undefined;
        if (sync && sync.syncStartedAt && progressPercentage > 0 && progressPercentage < 100) {
          const elapsedMs = Date.now() - sync.syncStartedAt.getTime();
          const estimatedTotalMs = (elapsedMs / progressPercentage) * 100;
          estimatedTimeRemaining = Math.round((estimatedTotalMs - elapsedMs) / 1000); // 초 단위
        }

        result.push({
          platformId,
          progressPercentage,
          estimatedTimeRemaining,
        });
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch sync progress batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });

      // 실패 시 빈 배열 반환
      return platformIds.map((platformId) => ({
        platformId,
        progressPercentage: 0,
        estimatedTimeRemaining: undefined,
      }));
    }
  }

  // ==================== 복잡한 조회 메서드 (Repository 사용) ====================

  /**
   * 동기화가 필요한 플랫폼 조회 (스케줄링용)
   */
  async findSyncTargets(hoursAgo: number = 24): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findStaleSync(hoursAgo);
    } catch (error: unknown) {
      this.logger.error('Sync targets fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 타임아웃된 동기화 작업 조회 (모니터링용)
   */
  async findTimeoutSyncs(timeoutHours: number = 2): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findTimeoutSyncs(timeoutHours);
    } catch (error: unknown) {
      this.logger.error('Timeout syncs fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeoutHours,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 실패한 동기화 작업 조회 (재시도용)
   */
  async findFailedSyncs(hoursAgo?: number): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findFailedSyncs(hoursAgo);
    } catch (error: unknown) {
      this.logger.error('Failed syncs fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 초기 동기화가 필요한 플랫폼 조회
   */
  async findNeverSyncedPlatforms(): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findNeverSyncedPlatforms();
    } catch (error: unknown) {
      this.logger.error('Never synced platforms fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== 통계 집계 메서드 (Repository 사용) ====================

  /**
   * 전체 동기화 통계 조회
   */
  async getOverallStats(): Promise<SyncStats> {
    try {
      return await this.platformSyncRepo.getSyncProgressStats();
    } catch (error: unknown) {
      this.logger.error('Overall sync stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 동기화 상태별 개수 조회
   */
  async getStatusCounts(): Promise<Record<VideoSyncStatus, number>> {
    try {
      return await this.platformSyncRepo.getStatusCounts();
    } catch (error: unknown) {
      this.logger.error('Status counts fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // 에러 시 기본값 반환
      return {
        [VideoSyncStatus.NEVER_SYNCED]: 0,
        [VideoSyncStatus.IN_PROGRESS]: 0,
        [VideoSyncStatus.COMPLETED]: 0,
        [VideoSyncStatus.FAILED]: 0,
      };
    }
  }

  /**
   * 여러 플랫폼의 동기화 통계 조회 (배치 처리)
   */
  async getStatsByPlatformIds(platformIds: string[]): Promise<Record<string, SyncStats>> {
    try {
      return await this.platformSyncRepo.getStatsByPlatformIds(platformIds);
    } catch (error: unknown) {
      this.logger.error('Platform sync stats batch fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  /**
   * 동기화 시작
   */
  async startVideoSync(
    platformId: string,
    totalVideoCount?: number,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 이미 진행 중인지 확인
      const isInProgress = await this.isInProgress(platformId);
      if (isInProgress) {
        this.logger.warn('Sync already in progress', { platformId });
        throw CreatorException.platformSyncInProgress();
      }

      // 기존 동기화 정보 조회 또는 생성
      let syncEntity = await this.findByPlatformId(platformId);

      if (!syncEntity) {
        syncEntity = this.platformSyncRepo.create({
          platformId,
          videoSyncStatus: VideoSyncStatus.IN_PROGRESS,
          syncStartedAt: new Date(),
          lastVideoSyncAt: new Date(),
          totalVideoCount,
          syncedVideoCount: 0,
          failedVideoCount: 0,
        });
      } else {
        // 기존 동기화 정보 업데이트
        syncEntity.videoSyncStatus = VideoSyncStatus.IN_PROGRESS;
        syncEntity.syncStartedAt = new Date();
        syncEntity.lastVideoSyncAt = new Date();
        syncEntity.lastSyncError = undefined; // 이전 에러 클리어
        syncEntity.syncedVideoCount = 0;
        syncEntity.failedVideoCount = 0;

        if (totalVideoCount !== undefined) {
          syncEntity.totalVideoCount = totalVideoCount;
        }
      }

      await this.platformSyncRepo.save(syncEntity);

      this.logger.log('Video sync started', {
        platformId,
        syncId: syncEntity.id,
        totalVideoCount: syncEntity.totalVideoCount,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Video sync start failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        totalVideoCount,
      });

      throw CreatorException.platformSyncError();
    }
  }

  /**
   * 동기화 진행률 업데이트
   */
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

      await this.platformSyncRepo.save(syncEntity);

      this.logger.debug('Sync progress updated', {
        platformId,
        syncId: syncEntity.id,
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

      throw CreatorException.platformSyncError();
    }
  }

  /**
   * 동기화 완료
   */
  async completeVideoSync(
    platformId: string,
    syncData: {
      totalVideoCount?: number;
      syncedVideoCount: number;
      failedVideoCount: number;
      syncMetadata?: string;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      // 동기화 완료 정보 업데이트
      syncEntity.videoSyncStatus = VideoSyncStatus.COMPLETED;
      syncEntity.syncCompletedAt = new Date();
      syncEntity.lastVideoSyncAt = new Date();
      syncEntity.syncedVideoCount = syncData.syncedVideoCount;
      syncEntity.failedVideoCount = syncData.failedVideoCount;
      syncEntity.lastSyncError = undefined; // 성공 시 에러 메시지 초기화

      if (syncData.totalVideoCount !== undefined) {
        syncEntity.totalVideoCount = syncData.totalVideoCount;
      }

      if (syncData.syncMetadata) {
        syncEntity.syncMetadata = syncData.syncMetadata;
      }

      await this.platformSyncRepo.save(syncEntity);

      this.logger.log('Video sync completed', {
        platformId,
        syncId: syncEntity.id,
        totalVideos: syncEntity.totalVideoCount,
        syncedVideos: syncData.syncedVideoCount,
        failedVideos: syncData.failedVideoCount,
        progress: syncEntity.getSyncProgress(),
        successRate: syncEntity.getSyncSuccessRate(),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Video sync completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        syncData,
      });

      throw CreatorException.platformSyncError();
    }
  }

  /**
   * 동기화 실패 처리
   */
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

      await this.platformSyncRepo.save(syncEntity);

      this.logger.log('Video sync failed and recorded', {
        platformId,
        syncId: syncEntity.id,
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

      throw CreatorException.platformSyncError();
    }
  }

  /**
   * 수동 동기화 시작 (관리자 수동 실행용)
   */
  async startManualSync(platformId: string): Promise<void> {
    try {
      this.logger.log('Manual sync requested', { platformId });

      // startVideoSync 메서드를 사용하여 수동 동기화 시작
      // totalVideoCount는 동기화 과정에서 자동으로 확인됨
      await this.startVideoSync(platformId);

      this.logger.log('Manual sync started successfully', { platformId });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Manual sync start failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 플랫폼 동기화 초기화 (유틸리티)
   */
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
      const syncEntity = this.platformSyncRepo.create({
        platformId,
        videoSyncStatus: VideoSyncStatus.NEVER_SYNCED,
      });

      const result = await this.platformSyncRepo.save(syncEntity);

      this.logger.log('Platform sync initialized', {
        platformId,
        syncId: result.id,
      });
      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform sync initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncError();
    }
  }

  /**
   * 동기화 정보 리셋 (유틸리티)
   */
  async resetSync(platformId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const syncEntity = await this.findByPlatformIdOrFail(platformId);

      // 모든 동기화 정보 초기화
      syncEntity.videoSyncStatus = VideoSyncStatus.NEVER_SYNCED;
      syncEntity.syncStartedAt = undefined;
      syncEntity.syncCompletedAt = undefined;
      syncEntity.lastVideoSyncAt = undefined;
      syncEntity.totalVideoCount = undefined;
      syncEntity.syncedVideoCount = undefined;
      syncEntity.failedVideoCount = undefined;
      syncEntity.lastSyncError = undefined;
      syncEntity.syncMetadata = undefined;

      await this.platformSyncRepo.save(syncEntity);

      this.logger.log('Platform sync reset', {
        platformId,
        syncId: syncEntity.id,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform sync reset failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncError();
    }
  }
}
