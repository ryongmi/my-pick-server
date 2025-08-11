import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { VideoSyncStatus } from '@common/enums/index.js';

import { CreatorPlatformSyncRepository } from '../repositories/index.js';
import { CreatorPlatformSyncEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';

/**
 * 영상 동기화 기본 CRUD 서비스
 * CreatorPlatformSync 엔티티의 기본적인 CRUD 작업만 담당
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
      this.logger.error('Platform sync fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.syncFetchError();
    }
  }

  async findByPlatformIdOrFail(platformId: string): Promise<CreatorPlatformSyncEntity> {
    const sync = await this.findByPlatformId(platformId);
    
    if (!sync) {
      throw CreatorException.syncNotFound();
    }

    return sync;
  }

  /**
   * 동기화 진행 중 여부 확인
   */
  async isInProgress(platformId: string): Promise<boolean> {
    try {
      const sync = await this.findByPlatformId(platformId);
      return sync?.videoSyncStatus === VideoSyncStatus.IN_PROGRESS;
    } catch (error: unknown) {
      this.logger.error('Failed to check sync progress status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      return false;
    }
  }

  /**
   * 동기화 진행률 계산
   */
  async getSyncProgress(platformId: string): Promise<number> {
    try {
      const sync = await this.findByPlatformId(platformId);
      
      if (!sync || !sync.totalVideoCount || sync.totalVideoCount === 0) {
        return 0;
      }

      const synced = sync.syncedVideoCount || 0;
      return Math.round((synced / sync.totalVideoCount) * 100);
    } catch (error: unknown) {
      this.logger.error('Failed to calculate sync progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      return 0;
    }
  }

  /**
   * 플랫폼별 동기화 상태 배치 조회
   */
  async findByPlatformIds(
    platformIds: string[]
  ): Promise<Record<string, CreatorPlatformSyncEntity | null>> {
    try {
      if (platformIds.length === 0) return {};

      return await this.platformSyncRepo.findByPlatformIds(platformIds);
    } catch (error: unknown) {
      this.logger.error('Batch platform sync fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });

      throw CreatorException.syncBatchFetchError();
    }
  }

  /**
   * 동기화 정보 생성 또는 업데이트
   */
  async upsertSync(
    platformId: string, 
    syncData: Partial<CreatorPlatformSyncEntity>,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const existingSync = await this.findByPlatformId(platformId);

      if (existingSync) {
        Object.assign(existingSync, syncData);
        await this.platformSyncRepo.updateEntity(existingSync, transactionManager);
        this.logger.debug('Platform sync updated', { platformId });
      } else {
        const newSync = this.platformSyncRepo.create({
          platformId,
          videoSyncStatus: VideoSyncStatus.NEVER_SYNCED,
          ...syncData
        });
        await this.platformSyncRepo.saveEntity(newSync, transactionManager);
        this.logger.debug('Platform sync created', { platformId });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to upsert platform sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncUpsertError();
    }
  }

  /**
   * 동기화 정보 삭제
   */
  async deleteByPlatformId(platformId: string, _transactionManager?: EntityManager): Promise<void> {
    try {
      await this.platformSyncRepo.softDeleteById(platformId);
      
      this.logger.debug('Platform sync deleted', { platformId });
    } catch (error: unknown) {
      this.logger.error('Failed to delete platform sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncDeleteError();
    }
  }

  /**
   * 플랫폼 동기화 정보 초기화
   */
  async initializeSync(
    platformId: string,
    transactionManager?: EntityManager
  ): Promise<CreatorPlatformSyncEntity> {
    try {
      const syncData = {
        platformId,
        videoSyncStatus: VideoSyncStatus.NEVER_SYNCED,
        totalVideoCount: null,
        syncedVideoCount: null,
        failedVideoCount: null,
        lastVideoSyncAt: null,
        syncStartedAt: null,
        syncCompletedAt: null,
        isFullSync: false,
        isManualSync: false,
        lastSyncError: null,
      };

      const sync = this.platformSyncRepo.create(syncData);
      const savedSync = await this.platformSyncRepo.saveEntity(sync, transactionManager);

      this.logger.debug('Platform sync initialized', { platformId });
      
      return savedSync;
    } catch (error: unknown) {
      this.logger.error('Failed to initialize platform sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw CreatorException.syncInitializeError();
    }
  }
}