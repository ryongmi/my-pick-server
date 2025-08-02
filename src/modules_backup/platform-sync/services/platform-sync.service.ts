import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In } from 'typeorm';

import { SyncStatus, PlatformType } from '@common/enums/index.js';

import { CreatorPlatformRepository } from '../../creator/repositories/index.js';
import { CreatorPlatformEntity } from '../../creator/entities/index.js';
import { CreatorException } from '../../creator/exceptions/index.js';

@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  constructor(
    private readonly creatorPlatformRepo: CreatorPlatformRepository,
  ) {}

  // ==================== SCHEDULER SUPPORT METHODS ====================

  /**
   * YouTube 동기화용 활성 플랫폼 조회
   */
  async findActiveYouTubePlatformsForSync(): Promise<CreatorPlatformEntity[]> {
    try {
      return await this.creatorPlatformRepo.find({
        where: {
          type: PlatformType.YOUTUBE,
          isActive: true,
          syncStatus: SyncStatus.ACTIVE,
        },
        order: {
          videoSyncStatus: 'ASC', // NEVER_SYNCED 우선, 그 다음 CONSENT_CHANGED, 마지막 INCREMENTAL
          lastVideoSyncAt: 'ASC', // 오래된 것부터
        },
      });
    } catch (error: unknown) {
      this.logger.error('Failed to find active YouTube platforms for sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * Twitter 동기화용 활성 플랫폼 조회
   */
  async findActiveTwitterPlatformsForSync(): Promise<CreatorPlatformEntity[]> {
    try {
      return await this.creatorPlatformRepo.find({
        where: {
          // type: PlatformType.TWITTER, // TWITTER enum 미지원으로 주석 처리
          isActive: true,
          syncStatus: SyncStatus.ACTIVE,
        },
        relations: ['creator'],
      });
    } catch (error: unknown) {
      this.logger.error('Failed to find active Twitter platforms for sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 특정 크리에이터의 특정 타입 플랫폼 조회
   */
  async findByCreatorIdAndType(
    creatorId: string,
    platformType: PlatformType,
    includeCreator = false
  ): Promise<CreatorPlatformEntity | null> {
    try {
      return await this.creatorPlatformRepo.findOne({
        where: {
          creatorId,
          type: platformType,
          isActive: true,
        },
        relations: includeCreator ? ['creator'] : [],
      });
    } catch (error: unknown) {
      this.logger.error('Failed to find platform by creator ID and type', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType,
      });
      throw CreatorException.platformFetchError();
    }
  }

  /**
   * 플랫폼 동기화 상태 업데이트
   */
  async updateSyncStatus(
    platformId: string,
    updateData: Partial<Pick<CreatorPlatformEntity, 'syncStatus' | 'videoSyncStatus' | 'lastSyncAt' | 'lastVideoSyncAt' | 'syncedVideoCount' | 'totalVideoCount'>>
  ): Promise<void> {
    try {
      await this.creatorPlatformRepo.update(platformId, updateData);

      this.logger.debug('Platform sync status updated', {
        platformId,
        updateData,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform sync status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        updateData,
      });
      throw CreatorException.platformUpdateError();
    }
  }

  /**
   * 플랫폼 통계 정보 업데이트
   */
  async updateStatistics(
    platformId: string,
    statistics: Partial<Pick<CreatorPlatformEntity, 'followerCount' | 'contentCount' | 'totalViews'>>
  ): Promise<void> {
    try {
      await this.creatorPlatformRepo.update(platformId, statistics);

      this.logger.debug('Platform statistics updated', {
        platformId,
        statistics,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        statistics,
      });
      throw CreatorException.platformUpdateError();
    }
  }

  /**
   * 크리에이터의 모든 플랫폼 동기화 상태를 일괄 업데이트
   */
  async updatePlatformSyncStatusByCreatorId(
    creatorId: string,
    updateData: Partial<Pick<CreatorPlatformEntity, 'videoSyncStatus' | 'syncStatus' | 'lastSyncAt'>>,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const platforms = await this.creatorPlatformRepo.find({
        where: { creatorId, isActive: true },
      });

      if (platforms.length === 0) {
        this.logger.debug('No active platforms found for sync status update', { creatorId });
        return;
      }

      // 모든 플랫폼 ID 수집
      const platformIds = platforms.map((p) => p.id);

      // 일괄 업데이트 수행
      if (transactionManager) {
        await transactionManager.update(CreatorPlatformEntity, platformIds, updateData);
      } else {
        await this.creatorPlatformRepo.update(platformIds, updateData);
      }

      this.logger.debug('Platform sync status updated for creator', {
        creatorId,
        platformCount: platforms.length,
        updateData,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform sync status by creator ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        updateData,
      });
      throw CreatorException.platformUpdateError();
    }
  }

  /**
   * 플랫폼 목록을 ID로 조회
   */
  async findByIds(platformIds: string[]): Promise<CreatorPlatformEntity[]> {
    try {
      if (platformIds.length === 0) return [];

      return await this.creatorPlatformRepo.find({
        where: { id: In(platformIds) },
      });
    } catch (error: unknown) {
      this.logger.error('Failed to find platforms by IDs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformCount: platformIds.length,
      });
      throw CreatorException.platformFetchError();
    }
  }

  // ==================== BATCH SYNC METHODS ====================

  /**
   * YouTube 플랫폼 배치 동기화
   */
  async syncYouTubePlatformsBatch(limit = 50): Promise<{
    successCount: number;
    errorCount: number;
    totalProcessed: number;
  }> {
    try {
      this.logger.log('Starting YouTube platforms batch sync', { limit });

      const platforms = await this.findActiveYouTubePlatformsForSync();
      const platformsToSync = platforms.slice(0, limit);

      let successCount = 0;
      let errorCount = 0;

      for (const platform of platformsToSync) {
        try {
          await this.syncYouTubePlatformData(platform);
          successCount++;

          this.logger.debug('YouTube platform synced successfully', {
            platformId: platform.id,
            creatorId: platform.creatorId,
            channelId: platform.platformId,
          });
        } catch (syncError: unknown) {
          errorCount++;

          this.logger.warn('YouTube platform sync failed', {
            platformId: platform.id,
            creatorId: platform.creatorId,
            channelId: platform.platformId,
            error: syncError instanceof Error ? syncError.message : 'Unknown sync error',
          });

          // 동기화 실패 시 에러 상태로 마킹
          await this.updateSyncStatus(platform.id, {
            syncStatus: SyncStatus.ERROR,
            lastSyncAt: new Date(),
          });
        }
      }

      this.logger.log('YouTube platforms batch sync completed', {
        totalProcessed: platformsToSync.length,
        successCount,
        errorCount,
        totalAvailable: platforms.length,
      });

      return {
        successCount,
        errorCount,
        totalProcessed: platformsToSync.length,
      };
    } catch (error: unknown) {
      this.logger.error('YouTube platforms batch sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });

      return {
        successCount: 0,
        errorCount: 0,
        totalProcessed: 0,
      };
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * YouTube 플랫폼 데이터 동기화
   */
  private async syncYouTubePlatformData(platform: CreatorPlatformEntity): Promise<void> {
    try {
      // TODO: ExternalApiService 또는 YouTubeApiService 연동
      // 현재는 mock 데이터로 시뮬레이션

      // 예시: YouTube Data API v3 호출 로직
      // const channelData = await this.youtubeApiService.getChannelInfo(platform.platformId);

      // Mock 동기화 로직 (실제 구현 시 제거)
      const mockChannelData = {
        subscriberCount: Math.floor(Math.random() * 100000) + 1000, // 1K~100K 랜덤
        videoCount: Math.floor(Math.random() * 500) + 10, // 10~500 랜덤
        totalViews: Math.floor(Math.random() * 10000000) + 100000, // 100K~10M 랜덤
        isActive: Math.random() > 0.1, // 90% 확률로 활성
      };

      // 플랫폼 통계 업데이트
      await this.updateStatistics(platform.id, {
        followerCount: mockChannelData.subscriberCount,
        contentCount: mockChannelData.videoCount,
        totalViews: mockChannelData.totalViews,
      });

      // 동기화 상태 업데이트
      await this.updateSyncStatus(platform.id, {
        syncStatus: SyncStatus.ACTIVE,
        lastSyncAt: new Date(),
      });

      this.logger.debug('YouTube platform data synchronized', {
        platformId: platform.id,
        channelId: platform.platformId,
        oldFollowerCount: platform.followerCount,
        newFollowerCount: mockChannelData.subscriberCount,
        oldContentCount: platform.contentCount,
        newContentCount: mockChannelData.videoCount,
        oldTotalViews: platform.totalViews,
        newTotalViews: mockChannelData.totalViews,
      });
    } catch (error: unknown) {
      this.logger.warn('YouTube API sync failed', {
        platformId: platform.id,
        channelId: platform.platformId,
        error: error instanceof Error ? error.message : 'Unknown YouTube API error',
      });

      // YouTube API 실패 시 재시도하거나 에러 상태로 마킹
      throw error;
    }
  }
}