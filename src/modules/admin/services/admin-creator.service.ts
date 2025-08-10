import { Injectable, Logger } from '@nestjs/common';

// import { UpdateResult } from 'typeorm';

import { CreatorRepository } from '../../creator/repositories/index.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { ContentService } from '../../content/services/index.js';
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
    private readonly contentService: ContentService
  ) {}

  // ==================== PLATFORM 관리 메서드 (관리자 전용) ====================

  async addPlatformToCreator(creatorId: string, dto: CreatePlatformDto): Promise<void> {
    return this.adminPlatformService.addPlatformToCreator(creatorId, dto);
  }

  async updateCreatorPlatform(platformId: string, dto: UpdatePlatformDto): Promise<void> {
    return this.adminPlatformService.updateCreatorPlatform(platformId, dto);
  }

  async removeCreatorPlatform(platformId: string): Promise<void> {
    return this.adminPlatformService.removeCreatorPlatform(platformId);
  }

  async syncPlatformData(platformId: string): Promise<void> {
    return this.adminPlatformService.syncPlatformData(platformId);
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.creatorRepo.count();
    } catch (error: unknown) {
      this.logger.error('Failed to get total creator count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== 통계 메서드 ====================

  async getCreatorStatistics(creatorId: string): Promise<{
    followerCount: number;
    contentCount: number;
    totalViews: number;
  }> {
    try {
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
    } catch (error: unknown) {
      this.logger.error('Creator statistics calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      // 에러 발생 시 기본값 반환 (서비스 안정성)
      return {
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
      };
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async getContentCount(creatorId: string): Promise<number> {
    try {
      return await this.contentService.getContentCountByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to get content count from content service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  private async getTotalViews(creatorId: string): Promise<number> {
    try {
      // ContentService에 총 조회수 메서드 호출
      return await this.contentService.getTotalViewsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to get total views from content service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }
}
