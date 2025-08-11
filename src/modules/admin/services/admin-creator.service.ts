import { Injectable, Logger } from '@nestjs/common';

// import { UpdateResult } from 'typeorm';

import { CreatorRepository } from '../../creator/repositories/index.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { ContentService, ContentAdminStatisticsService } from '../../content/services/index.js';
import { CreatePlatformDto, UpdatePlatformDto } from '../../creator/dto/index.js';
// import { CreatorException } from '../../creator/exceptions/index.js';

import { AdminPlatformService } from './admin-platform.service.js';

@Injectable()
export class AdminCreatorService {
  private readonly logger = new Logger(AdminCreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly adminPlatformService: AdminPlatformService,
    private readonly contentService: ContentService,
    private readonly contentStatisticsService: ContentAdminStatisticsService,
  ) {}

  // ==================== PLATFORM 관리 메서드 (관리자 전용) ====================

  async addPlatformToCreator(creatorId: string, dto: CreatePlatformDto): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.adminPlatformService.addPlatformToCreator(creatorId, dto);
      },
      'Add platform to creator',
      { creatorId, platformType: dto.type }
    );
  }

  async updateCreatorPlatform(platformId: string, dto: UpdatePlatformDto): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.adminPlatformService.updateCreatorPlatform(platformId, dto);
      },
      'Update creator platform',
      { platformId }
    );
  }

  async removeCreatorPlatform(platformId: string): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.adminPlatformService.removeCreatorPlatform(platformId);
      },
      'Remove creator platform',
      { platformId }
    );
  }

  async syncPlatformData(platformId: string): Promise<void> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.adminPlatformService.syncPlatformData(platformId);
      },
      'Sync platform data',
      { platformId }
    );
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.creatorRepo.count();
      },
      'Get total creator count',
      {},
      0
    );
  }

  // ==================== 통계 메서드 ====================

  async getCreatorStatistics(creatorId: string): Promise<{
    followerCount: number;
    contentCount: number;
    totalViews: number;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        // CreatorPlatform에서 followerCount 총합 계산
        const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
        const followerCount = platforms.reduce(
          (sum: number, platform) => sum + (platform.followerCount || 0),
          0
        );

        // Content 개수와 총 조회수 계산 (TCP 통신 사용)
        const [contentCount, totalViews] = await Promise.all([
          this.getContentCount(creatorId),
          this.getTotalViews(creatorId),
        ]);

        this.logger.debug('Creator statistics calculated', {
          creatorId,
          followerCount,
          contentCount,
          totalViews,
          platformCount: platforms.length,
        });

        return {
          followerCount,
          contentCount,
          totalViews,
        };
      },
      'Get creator statistics',
      { creatorId },
      {
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
      }
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

      // Re-throw the error if no fallback value is provided
      throw error;
    }
  }

  private async getContentCount(creatorId: string): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getContentCountByCreatorId(creatorId);
      },
      'Get content count from content service',
      { creatorId },
      0
    );
  }

  private async getTotalViews(creatorId: string): Promise<number> {
    return await this.executeWithErrorHandling(
      async () => {
        return await this.contentStatisticsService.getTotalViewsByCreatorId(creatorId);
      },
      'Get total views from content service',
      { creatorId },
      0
    );
  }
}
