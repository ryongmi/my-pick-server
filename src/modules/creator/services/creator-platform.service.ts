import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import { SyncStatus, PlatformType } from '@common/enums/index.js';

import { CreatorPlatformRepository } from '../repositories/index.js';
import { CreatorPlatformEntity } from '../entities/index.js';
import { AddPlatformDto, UpdatePlatformDto } from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

import { CreatorService } from './creator.service.js';

@Injectable()
export class CreatorPlatformService {
  private readonly logger = new Logger(CreatorPlatformService.name);

  constructor(
    private readonly creatorPlatformRepo: CreatorPlatformRepository,
    private readonly creatorService: CreatorService
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformEntity[]> {
    return this.creatorPlatformRepo.findByCreatorId(creatorId);
  }

  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformEntity[]> {
    return this.creatorPlatformRepo.findByCreatorIds(creatorIds);
  }

  async findById(platformId: string): Promise<CreatorPlatformEntity | null> {
    return this.creatorPlatformRepo.findOneById(platformId);
  }

  async findByIdOrFail(platformId: string): Promise<CreatorPlatformEntity> {
    const platform = await this.findById(platformId);
    if (!platform) {
      this.logger.warn('Platform not found', { platformId });
      throw CreatorException.platformNotFound();
    }
    return platform;
  }

  // ==================== PLATFORM 관리 메서드 ====================

  async addMultiplePlatformsToCreator(
    creatorId: string,
    platformDtos: AddPlatformDto[],
    transactionManager?: EntityManager
  ): Promise<void> {
    if (platformDtos.length === 0) {
      this.logger.debug('No platforms to add', { creatorId });
      return;
    }

    try {
      // 1. Creator 존재 확인
      const creator = await this.creatorService.findByIdOrFail(creatorId);

      // 2. 배치 중복 플랫폼 확인
      const platformKeys = platformDtos.map((dto) => ({
        type: dto.type,
        platformId: dto.platformId,
      }));

      const existingPlatforms = await this.creatorPlatformRepo.find({
        where: platformKeys.map((key) => ({
          creatorId,
          type: key.type,
          platformId: key.platformId,
        })),
      });

      if (existingPlatforms.length > 0) {
        const duplicateInfo = existingPlatforms.map((p) => `${p.type}:${p.platformId}`).join(', ');
        this.logger.warn('Duplicate platforms found for creator', {
          creatorId,
          duplicatePlatforms: duplicateInfo,
          totalRequested: platformDtos.length,
          duplicateCount: existingPlatforms.length,
        });
        throw CreatorException.platformAlreadyExists();
      }

      // 3. Platform 엔티티들 배치 생성
      const platformEntities = platformDtos.map((dto) => {
        const platform = new CreatorPlatformEntity();
        Object.assign(platform, {
          creatorId,
          type: dto.type,
          platformId: dto.platformId,
          url: dto.url,
          followerCount: dto.followerCount || 0,
          contentCount: dto.contentCount || 0,
          totalViews: dto.totalViews || 0,
          isActive: dto.isActive ?? true,
        });
        return platform;
      });

      // 4. 배치 저장 (트랜잭션 내에서 처리)
      let savedPlatforms: CreatorPlatformEntity[];
      if (transactionManager) {
        // 기존 트랜잭션 사용
        savedPlatforms = await transactionManager.save(CreatorPlatformEntity, platformEntities);
      } else {
        // 새 트랜잭션 생성
        savedPlatforms = await this.creatorPlatformRepo.save(platformEntities);
      }

      this.logger.log('Multiple platforms added to creator successfully', {
        creatorId,
        creatorName: creator.name,
        platformCount: savedPlatforms.length,
        platformTypes: platformDtos.map((dto) => dto.type),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Add multiple platforms to creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformCount: platformDtos.length,
        platformTypes: platformDtos.map((dto) => dto.type),
      });

      throw CreatorException.platformCreateError();
    }
  }

  async addPlatformToCreator(creatorId: string, dto: AddPlatformDto): Promise<void> {
    try {
      // 1. Creator 존재 확인
      const creator = await this.creatorService.findByIdOrFail(creatorId);

      // 2. 중복 플랫폼 확인
      const existingPlatform = await this.creatorPlatformRepo.findOne({
        where: {
          creatorId,
          type: dto.type,
          platformId: dto.platformId,
        },
      });

      if (existingPlatform) {
        this.logger.warn('Platform already exists for creator', {
          creatorId,
          platformType: dto.type,
          platformId: dto.platformId,
        });
        throw CreatorException.platformAlreadyExists();
      }

      // 3. Platform 엔티티 생성 및 저장
      const platform = new CreatorPlatformEntity();
      Object.assign(platform, {
        creatorId,
        type: dto.type,
        platformId: dto.platformId,
        url: dto.url,
        followerCount: dto.followerCount || 0,
        contentCount: dto.contentCount || 0,
        totalViews: dto.totalViews || 0,
        isActive: dto.isActive ?? true,
      });

      await this.creatorPlatformRepo.saveEntity(platform);

      this.logger.log('Platform added to creator successfully', {
        creatorId,
        platformId: platform.id,
        platformType: dto.type,
        creatorName: creator.name,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Add platform to creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType: dto.type,
        platformId: dto.platformId,
      });

      throw CreatorException.platformCreateError();
    }
  }

  async createPlatform(
    data: {
      creatorId: string;
      type: PlatformType;
      platformId: string;
      url: string;
      displayName?: string;
      isActive: boolean;
      syncStatus: SyncStatus;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. Creator 존재 확인
      const creator = await this.creatorService.findByIdOrFail(data.creatorId);

      // 2. 중복 플랫폼 확인
      const existingPlatform = await this.creatorPlatformRepo.findOne({
        where: {
          creatorId: data.creatorId,
          type: data.type,
          platformId: data.platformId,
        },
      });

      if (existingPlatform) {
        this.logger.warn('Platform already exists for creator', {
          creatorId: data.creatorId,
          platformType: data.type,
          platformId: data.platformId,
        });
        throw CreatorException.platformAlreadyExists();
      }

      // 3. Platform 엔티티 생성
      const platform = new CreatorPlatformEntity();
      Object.assign(platform, {
        creatorId: data.creatorId,
        type: data.type,
        platformId: data.platformId,
        url: data.url,
        displayName: data.displayName,
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
        isActive: data.isActive,
        syncStatus: data.syncStatus,
      });

      // 4. 저장
      if (transactionManager) {
        await transactionManager.save(platform);
      } else {
        await this.creatorPlatformRepo.saveEntity(platform);
      }

      this.logger.log('Platform created successfully', {
        creatorId: data.creatorId,
        platformId: platform.id,
        platformType: data.type,
        creatorName: creator.name,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId: data.creatorId,
        platformType: data.type,
        platformId: data.platformId,
      });

      throw CreatorException.platformCreateError();
    }
  }

  async updateCreatorPlatform(platformId: string, dto: UpdatePlatformDto): Promise<void> {
    try {
      // 1. Platform 존재 확인
      const platform = await this.findByIdOrFail(platformId);

      // 2. 업데이트 수행
      Object.assign(platform, dto);
      await this.creatorPlatformRepo.saveEntity(platform);

      this.logger.log('Creator platform updated successfully', {
        platformId,
        creatorId: platform.creatorId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Update creator platform failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
        updatedFields: Object.keys(dto),
      });

      throw CreatorException.platformUpdateError();
    }
  }

  async removeCreatorPlatform(platformId: string): Promise<void> {
    try {
      // 1. Platform 존재 확인
      const platform = await this.findByIdOrFail(platformId);

      // 2. 최소 1개 플랫폼 유지 검증
      const creatorPlatforms = await this.findByCreatorId(platform.creatorId);
      if (creatorPlatforms.length <= 1) {
        this.logger.warn('Cannot remove last platform from creator', {
          platformId,
          creatorId: platform.creatorId,
          platformCount: creatorPlatforms.length,
        });
        throw CreatorException.cannotRemoveLastPlatform();
      }

      // 3. 삭제 수행
      await this.creatorPlatformRepo.delete(platformId);

      this.logger.log('Creator platform removed successfully', {
        platformId,
        creatorId: platform.creatorId,
        platformType: platform.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Remove creator platform failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformDeleteError();
    }
  }

  /**
   * Creator 플랫폼 삭제 (removeCreatorPlatform의 별칭)
   */
  async deleteCreatorPlatform(platformId: string): Promise<void> {
    return this.removeCreatorPlatform(platformId);
  }

  async syncPlatformData(platformId: string): Promise<void> {
    try {
      // 1. Platform 존재 확인
      const platform = await this.findByIdOrFail(platformId);

      // 2. 플랫폼별 외부 API 동기화
      let syncData: {
        followerCount?: number;
        contentCount?: number;
        totalViews?: number;
        isActive?: boolean;
      } = {};
      let syncStatus = SyncStatus.ACTIVE;

      try {
        switch (platform.type) {
          case PlatformType.YOUTUBE:
            syncData = await this.syncYouTubePlatformData(platform);
            break;
          // case PlatformType.TWITTER:
          //   syncData = await this.syncTwitterPlatformData(platform);
          //   break;
          default:
            this.logger.warn('Unsupported platform type for sync', {
              platformId,
              platformType: platform.type,
            });
            // 지원하지 않는 플랫폼이어도 동기화 시간은 업데이트
            syncData = {};
        }
      } catch (syncError: unknown) {
        this.logger.warn('External API sync failed, marking platform as error', {
          platformId,
          platformType: platform.type,
          error: syncError instanceof Error ? syncError.message : 'Unknown sync error',
        });
        syncStatus = SyncStatus.ERROR;
      }

      // 3. 동기화된 데이터로 Platform 업데이트
      Object.assign(platform, {
        ...syncData,
        lastSyncAt: new Date(),
        syncStatus,
      });

      await this.creatorPlatformRepo.saveEntity(platform);

      this.logger.log('Platform data synchronized successfully', {
        platformId,
        creatorId: platform.creatorId,
        platformType: platform.type,
        syncedAt: platform.lastSyncAt,
        syncStatus,
        followerCountUpdated: syncData.followerCount !== undefined,
        contentCountUpdated: syncData.contentCount !== undefined,
        totalViewsUpdated: syncData.totalViews !== undefined,
        statusUpdated: syncData.isActive !== undefined,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform data sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncError();
    }
  }

  // ==================== AGGREGATION METHODS ====================

  async getAggregatedStats(creatorId: string): Promise<{
    totalFollowerCount: number;
    totalContentCount: number;
    totalViews: number;
  }> {
    const platforms = await this.findByCreatorId(creatorId);

    return {
      totalFollowerCount: platforms.reduce((sum, p) => sum + p.followerCount, 0),
      totalContentCount: platforms.reduce((sum, p) => sum + p.contentCount, 0),
      totalViews: platforms.reduce((sum, p) => sum + p.totalViews, 0),
    };
  }

  // ==================== BULK UPDATE METHODS ====================

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

  // ==================== PRIVATE HELPER METHODS ====================

  // 🔥 YouTube 플랫폼 데이터 동기화
  private async syncYouTubePlatformData(
    platform: CreatorPlatformEntity
  ): Promise<{
    followerCount?: number;
    contentCount?: number;
    totalViews?: number;
    isActive?: boolean;
  }> {
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

      this.logger.debug('YouTube platform data fetched', {
        platformId: platform.id,
        channelId: platform.platformId,
        oldFollowerCount: platform.followerCount,
        newFollowerCount: mockChannelData.subscriberCount,
        oldContentCount: platform.contentCount,
        newContentCount: mockChannelData.videoCount,
        oldTotalViews: platform.totalViews,
        newTotalViews: mockChannelData.totalViews,
      });

      return {
        followerCount: mockChannelData.subscriberCount,
        contentCount: mockChannelData.videoCount,
        totalViews: mockChannelData.totalViews,
        isActive: mockChannelData.isActive,
      };
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
