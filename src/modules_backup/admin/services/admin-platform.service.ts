import { Injectable, Logger, HttpException } from '@nestjs/common';

import { SyncStatus, PlatformType } from '@common/enums/index.js';

import { CreatorPlatformRepository } from '../../creator/repositories/index.js';
import { CreatorPlatformEntity } from '../../creator/entities/index.js';
import { CreatePlatformDto, UpdatePlatformDto } from '../../creator/dto/index.js';
import { CreatorException } from '../../creator/exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { YouTubeApiService } from '../../external-api/services/youtube-api.service.js';

@Injectable()
export class AdminPlatformService {
  private readonly logger = new Logger(AdminPlatformService.name);

  constructor(
    private readonly creatorPlatformRepo: CreatorPlatformRepository,
    private readonly creatorService: CreatorService,
    private readonly youtubeApiService: YouTubeApiService
  ) {}

  // ==================== ADMIN PLATFORM 관리 메서드 ====================

  async addPlatformToCreator(creatorId: string, dto: CreatePlatformDto): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
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
      },
      'Add platform to creator via admin',
      {
        creatorId,
        platformType: dto.type,
        platformId: dto.platformId,
      }
    );
  }

  async updateCreatorPlatform(platformId: string, dto: UpdatePlatformDto): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
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
      },
      'Update creator platform via admin',
      {
        platformId,
        updatedFields: Object.keys(dto),
      }
    );
  }

  async removeCreatorPlatform(platformId: string): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
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
      },
      'Remove creator platform via admin',
      { platformId }
    );
  }

  /**
   * Creator 플랫폼 삭제 (removeCreatorPlatform의 별칭)
   */
  async deleteCreatorPlatform(platformId: string): Promise<void> {
    return this.removeCreatorPlatform(platformId);
  }

  async syncPlatformData(platformId: string): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
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
      },
      'Sync platform data via admin',
      { platformId }
    );
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      // Re-throw appropriate exception based on operation type
      if (operationName.includes('Add') || operationName.includes('Create')) {
        throw CreatorException.platformCreateError();
      } else if (operationName.includes('Update')) {
        throw CreatorException.platformUpdateError();
      } else if (operationName.includes('Remove') || operationName.includes('Delete')) {
        throw CreatorException.platformDeleteError();
      } else if (operationName.includes('Sync')) {
        throw CreatorException.platformSyncError();
      }

      // Default error
      throw CreatorException.platformOperationError();
    }
  }

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
      // YouTubeApiService를 통한 실제 API 호출
      const channelData = await this.youtubeApiService.getChannelInfo(platform.platformId);

      if (!channelData) {
        this.logger.warn('YouTube channel data not found', {
          platformId: platform.id,
          channelId: platform.platformId,
        });
        
        // 데이터를 찾을 수 없는 경우 비활성화 상태로 설정
        return {
          followerCount: platform.followerCount || 0,
          contentCount: platform.contentCount || 0,
          totalViews: platform.totalViews || 0,
          isActive: false,
        };
      }

      // 실제 YouTube API 데이터를 사용
      const syncedData = {
        subscriberCount: channelData.statistics.subscriberCount || 0,
        videoCount: channelData.statistics.videoCount || 0,
        totalViews: channelData.statistics.viewCount || 0,
        isActive: true, // API에서 데이터를 성공적으로 가져온 경우 활성화
      };

      this.logger.debug('YouTube platform data fetched via admin', {
        platformId: platform.id,
        channelId: platform.platformId,
        oldFollowerCount: platform.followerCount,
        newFollowerCount: syncedData.subscriberCount,
        oldContentCount: platform.contentCount,
        newContentCount: syncedData.videoCount,
        oldTotalViews: platform.totalViews,
        newTotalViews: syncedData.totalViews,
      });

      return {
        followerCount: syncedData.subscriberCount,
        contentCount: syncedData.videoCount,
        totalViews: syncedData.totalViews,
        isActive: syncedData.isActive,
      };
    } catch (error: unknown) {
      this.logger.warn('YouTube API sync failed via admin', {
        platformId: platform.id,
        channelId: platform.platformId,
        error: error instanceof Error ? error.message : 'Unknown YouTube API error',
      });

      // YouTube API 실패 시 기존 데이터 유지하되 비활성화 상태로 설정
      return {
        followerCount: platform.followerCount || 0,
        contentCount: platform.contentCount || 0,
        totalViews: platform.totalViews || 0,
        isActive: false,
      };
    }
  }
}
