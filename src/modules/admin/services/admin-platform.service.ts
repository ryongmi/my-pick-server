import { Injectable, Logger, HttpException } from '@nestjs/common';

import { SyncStatus, PlatformType } from '@common/enums/index.js';

import { CreatorPlatformRepository } from '../../creator/repositories/index.js';
import { CreatorPlatformEntity } from '../../creator/entities/index.js';
import { CreatePlatformDto, UpdatePlatformDto } from '../../creator/dto/index.js';
import { CreatorException } from '../../creator/exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';

@Injectable()
export class AdminPlatformService {
  private readonly logger = new Logger(AdminPlatformService.name);

  constructor(
    private readonly creatorPlatformRepo: CreatorPlatformRepository,
    private readonly creatorService: CreatorService
  ) {}

  // ==================== ADMIN PLATFORM 관리 메서드 ====================

  async addPlatformToCreator(creatorId: string, dto: CreatePlatformDto): Promise<void> {
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
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
        isActive: true,
      });

      await this.creatorPlatformRepo.saveEntity(platform);

      this.logger.log('Platform added to creator successfully via admin', {
        creatorId,
        platformId: platform.id,
        platformType: dto.type,
        creatorName: creator.name,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Add platform to creator failed via admin', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType: dto.type,
        platformId: dto.platformId,
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

      this.logger.log('Creator platform updated successfully via admin', {
        platformId,
        creatorId: platform.creatorId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Update creator platform failed via admin', {
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
      const creatorPlatforms = await this.creatorPlatformRepo.find({
        where: { creatorId: platform.creatorId },
      });
      if (creatorPlatforms.length <= 1) {
        this.logger.warn('Cannot remove last platform from creator', {
          platformId,
          creatorId: platform.creatorId,
          platformCount: creatorPlatforms.length,
        });
        throw new Error('Cannot remove last platform from creator');
      }

      // 3. 삭제 수행
      await this.creatorPlatformRepo.delete(platformId);

      this.logger.log('Creator platform removed successfully via admin', {
        platformId,
        creatorId: platform.creatorId,
        platformType: platform.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Remove creator platform failed via admin', {
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

      this.logger.log('Platform data synchronized successfully via admin', {
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

      this.logger.error('Platform data sync failed via admin', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });

      throw CreatorException.platformSyncError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async findByIdOrFail(platformId: string): Promise<CreatorPlatformEntity> {
    const platform = await this.creatorPlatformRepo.findOneById(platformId);
    if (!platform) {
      this.logger.warn('Platform not found', { platformId });
      throw CreatorException.platformNotFound();
    }
    return platform;
  }

  // 🔥 YouTube 플랫폼 데이터 동기화
  private async syncYouTubePlatformData(platform: CreatorPlatformEntity): Promise<{
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

      this.logger.debug('YouTube platform data fetched via admin', {
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
      this.logger.warn('YouTube API sync failed via admin', {
        platformId: platform.id,
        channelId: platform.platformId,
        error: error instanceof Error ? error.message : 'Unknown YouTube API error',
      });

      // YouTube API 실패 시 재시도하거나 에러 상태로 마킹
      throw error;
    }
  }
}
