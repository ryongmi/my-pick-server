import { Injectable, Logger, HttpException } from '@nestjs/common';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorPlatformSyncRepository, type SyncStats } from '../repositories/index.js';
import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

/**
 * 동기화 스케줄링 및 배치 처리 전용 서비스
 * 동기화 대상 선정, 통계 집계, 배치 조회 담당
 */
@Injectable()
export class CreatorSyncSchedulerService {
  private readonly logger = new Logger(CreatorSyncSchedulerService.name);

  constructor(private readonly platformSyncRepo: CreatorPlatformSyncRepository) {}

  // ==================== 배치 처리 메서드 ====================

  /**
   * 동기화 진행률 배치 조회
   */
  async getSyncProgressBatch(platformIds: string[]): Promise<
    Record<
      string,
      {
        status: VideoSyncStatus;
        progress: number;
        lastSyncAt?: Date;
        errorMessage?: string;
      }
    >
  > {
    try {
      if (platformIds.length === 0) return {};

      const syncs = await this.platformSyncRepo.findByPlatformIds(platformIds);
      const result: Record<string, {
        status: VideoSyncStatus;
        progress: number;
        lastSyncAt?: Date;
        errorMessage?: string;
      }> = {};

      platformIds.forEach((platformId) => {
        const sync = syncs[platformId];
        
        if (!sync) {
          result[platformId] = {
            status: VideoSyncStatus.NEVER_SYNCED,
            progress: 0,
          };
          return;
        }

        let progress = 0;
        if (sync.totalVideoCount && sync.totalVideoCount > 0) {
          const synced = sync.syncedVideoCount || 0;
          progress = Math.round((synced / sync.totalVideoCount) * 100);
        }

        const resultItem: {
          status: VideoSyncStatus;
          progress: number;
          lastSyncAt?: Date;
          errorMessage?: string;
        } = {
          status: sync.videoSyncStatus,
          progress,
        };

        if (sync.lastVideoSyncAt) {
          resultItem.lastSyncAt = sync.lastVideoSyncAt;
        }

        if (sync.lastSyncError) {
          resultItem.errorMessage = sync.lastSyncError;
        }

        result[platformId] = resultItem;
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Failed to get sync progress batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncProgressFetchError();
    }
  }

  // ==================== 스케줄링 대상 조회 ====================

  /**
   * 동기화 대상 플랫폼 조회
   */
  async findSyncTargets(hoursAgo: number = 24): Promise<CreatorPlatformSyncEntity[]> {
    try {
      // Repository의 기존 메서드를 사용하여 동기화 대상 조회
      const [staleSyncs, neverSynced, failedSyncs, timeoutSyncs] = await Promise.all([
        this.platformSyncRepo.findStaleSync(hoursAgo),
        this.platformSyncRepo.findNeverSyncedPlatforms(),
        this.platformSyncRepo.findFailedSyncs(hoursAgo),
        this.platformSyncRepo.findTimeoutSyncs(2), // 2시간 타임아웃
      ]);

      // 중복 제거를 위해 Set 사용
      const uniqueSyncs = new Map<string, CreatorPlatformSyncEntity>();

      [...neverSynced, ...staleSyncs, ...failedSyncs, ...timeoutSyncs].forEach((sync) => {
        if (!uniqueSyncs.has(sync.platformId)) {
          uniqueSyncs.set(sync.platformId, sync);
        }
      });

      const targets = Array.from(uniqueSyncs.values());

      this.logger.debug('Sync targets found', {
        staleSyncs: staleSyncs.length,
        neverSynced: neverSynced.length,
        failedSyncs: failedSyncs.length,
        timeoutSyncs: timeoutSyncs.length,
        uniqueTargets: targets.length,
        hoursAgo,
      });

      return targets;
    } catch (error: unknown) {
      this.logger.error('Failed to find sync targets', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncTargetFetchError();
    }
  }

  /**
   * 타임아웃된 동기화 조회
   */
  async findTimeoutSyncs(timeoutHours: number = 2): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findTimeoutSyncs(timeoutHours);
    } catch (error: unknown) {
      this.logger.error('Failed to find timeout syncs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeoutHours,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.timeoutSyncFetchError();
    }
  }

  /**
   * 실패한 동기화 조회
   */
  async findFailedSyncs(hoursAgo?: number): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findFailedSyncs(hoursAgo);
    } catch (error: unknown) {
      this.logger.error('Failed to find failed syncs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursAgo,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.failedSyncFetchError();
    }
  }

  /**
   * 한번도 동기화하지 않은 플랫폼 조회
   */
  async findNeverSyncedPlatforms(): Promise<CreatorPlatformSyncEntity[]> {
    try {
      return await this.platformSyncRepo.findNeverSyncedPlatforms();
    } catch (error: unknown) {
      this.logger.error('Failed to find never synced platforms', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.neverSyncedFetchError();
    }
  }

  // ==================== 통계 집계 메서드 ====================

  /**
   * 전체 동기화 통계 조회
   */
  async getOverallStats(): Promise<SyncStats> {
    try {
      // Repository의 기존 통계 메서드 사용
      const stats = await this.platformSyncRepo.getSyncProgressStats();

      this.logger.debug('Overall sync stats retrieved', {
        totalPlatforms: stats.totalPlatforms,
        totalVideos: stats.totalVideos,
        syncedVideos: stats.syncedVideos,
        failedVideos: stats.failedVideos,
        overallProgress: stats.overallProgress,
        overallSuccessRate: stats.overallSuccessRate,
      });

      return stats;
    } catch (error: unknown) {
      this.logger.error('Failed to get overall sync stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncStatsFetchError();
    }
  }

  /**
   * 상태별 동기화 수 조회
   */
  async getStatusCounts(): Promise<Record<VideoSyncStatus, number>> {
    try {
      const counts = await this.platformSyncRepo.getStatusCounts();
      
      // 모든 상태에 대해 기본값 0 설정
      const result: Record<VideoSyncStatus, number> = {
        [VideoSyncStatus.NEVER_SYNCED]: 0,
        [VideoSyncStatus.INITIAL_SYNCING]: 0,
        [VideoSyncStatus.INCREMENTAL]: 0,
        [VideoSyncStatus.CONSENT_CHANGED]: 0,
        [VideoSyncStatus.IN_PROGRESS]: 0,
        [VideoSyncStatus.COMPLETED]: 0,
        [VideoSyncStatus.FAILED]: 0,
      };

      // 실제 카운트로 업데이트
      Object.entries(counts).forEach(([status, count]) => {
        if (Object.values(VideoSyncStatus).includes(status as VideoSyncStatus)) {
          result[status as VideoSyncStatus] = count;
        }
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Failed to get status counts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.statusCountFetchError();
    }
  }

  /**
   * 플랫폼별 동기화 통계 조회
   */
  async getStatsByPlatformIds(platformIds: string[]): Promise<Record<string, SyncStats>> {
    try {
      if (platformIds.length === 0) return {};

      return await this.platformSyncRepo.getStatsByPlatformIds(platformIds);
    } catch (error: unknown) {
      this.logger.error('Failed to get stats by platform IDs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncStatsFetchError();
    }
  }
}