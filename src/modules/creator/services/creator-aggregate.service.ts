import { Injectable, Logger, HttpException } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CacheService } from '@database/redis/index.js';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  DetailedPlatformStatsDto,
} from '../dto/index.js';

import { CreatorService } from './creator.service.js';
import { CreatorStatisticsService } from './creator-statistics.service.js';
import { CreatorPlatformStatisticsService } from './creator-platform-statistics.service.js';
import { CreatorCategoryStatisticsService } from './creator-category-statistics.service.js';

@Injectable()
export class CreatorAggregateService {
  private readonly logger = new Logger(CreatorAggregateService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorService: CreatorService,
    private readonly creatorStatisticsService: CreatorStatisticsService,
    private readonly creatorPlatformStatisticsService: CreatorPlatformStatisticsService,
    private readonly creatorCategoryStatisticsService: CreatorCategoryStatisticsService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async searchCreators(
    query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    try {
      const result = await this.creatorRepo.searchCreators(query);

      if (result.items.length === 0) {
        return { items: [], pageInfo: result.pageInfo };
      }

      const items = this.buildCreatorSearchResults(result.items);

      this.logger.debug('Creator search completed', {
        totalFound: result.pageInfo.totalItems,
        page: query.page,
        limit: query.limit,
        hasNameFilter: !!query.name,
        category: query.category,
      });

      return {
        items,
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      this.logger.error('Creator search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async getCreatorById(creatorId: string): Promise<CreatorDetailDto> {
    try {
      // 1. 캐시에서 먼저 조회 시도
      const cached = await this.cacheService.getCreatorDetail(creatorId);
      if (cached) {
        this.logger.debug('Creator detail served from cache', { creatorId });
        return cached;
      }

      // 2. 캐시 미스 시 DB에서 조회
      const creator = await this.creatorService.findByIdOrFail(creatorId);

      // 3. 플랫폼 통계 조회 (캐시 적용)
      let platformStats = await this.cacheService.getPlatformStats(creatorId);
      if (!platformStats) {
        platformStats = await this.buildDetailedPlatformStats(creatorId);
        await this.cacheService.setPlatformStats(creatorId, platformStats);
      }

      // 4. DTO 생성
      const detailDto = this.buildCreatorDetail(creator, platformStats);

      // 5. 결과 캐싱
      await this.cacheService.setCreatorDetail(creatorId, detailDto);

      this.logger.debug('Creator detail fetched and cached', {
        creatorId,
        name: creator.name,
        platformCount: platformStats?.platformCount || 0,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async getTrendingCreators(limit: number = 20): Promise<CreatorSearchResultDto[]> {
    try {
      // DB에서 트렌딩 크리에이터 조회 (가장 최근 생성된 크리에이터)
      const creators = await this.creatorRepo.find({
        order: { createdAt: 'DESC' },
        take: limit
      });
      const trendingResults = this.buildCreatorSearchResults(creators);

      this.logger.debug('Trending creators fetched and cached', {
        count: creators.length,
        limit,
      });

      return trendingResults;
    } catch (error: unknown) {
      this.logger.error('Trending creators fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== 캐시 관리 메서드 ====================

  async invalidateCreatorCache(creatorId: string): Promise<void> {
    await this.cacheService.invalidateCreatorRelatedCaches(creatorId);
    this.logger.debug('Creator cache invalidated', { creatorId });
  }

  async refreshCreatorCache(creatorId: string): Promise<void> {
    // 캐시 무효화 후 새로 생성
    await this.invalidateCreatorCache(creatorId);
    await this.getCreatorById(creatorId);
    this.logger.debug('Creator cache refreshed', { creatorId });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private buildCreatorSearchResults(creators: Partial<CreatorEntity>[]): CreatorSearchResultDto[] {
    return creators.map((creator) =>
      plainToInstance(CreatorSearchResultDto, creator, {
        excludeExtraneousValues: true,
      })
    );
  }

  private buildCreatorDetail(
    creator: CreatorEntity,
    platformStats: DetailedPlatformStatsDto
  ): CreatorDetailDto {
    const result: CreatorDetailDto = {
      id: creator.id,
      name: creator.name,
      displayName: creator.displayName,
      isVerified: creator.isVerified,
      category: creator.category,
      status: creator.status,
      verificationStatus: creator.verificationStatus,
      platformStats,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (creator.userId !== undefined && creator.userId !== null) {
      result.userId = creator.userId;
    }
    if (creator.avatar !== undefined && creator.avatar !== null) {
      result.avatar = creator.avatar;
    }
    if (creator.description !== undefined && creator.description !== null) {
      result.description = creator.description;
    }
    if (creator.tags !== undefined && creator.tags !== null) {
      result.tags = creator.tags;
    }
    if (creator.lastActivityAt !== undefined && creator.lastActivityAt !== null) {
      result.lastActivityAt = creator.lastActivityAt;
    }
    if (creator.socialLinks !== undefined && creator.socialLinks !== null) {
      result.socialLinks = creator.socialLinks;
    }

    return result;
  }

  private async buildDetailedPlatformStats(creatorId: string): Promise<DetailedPlatformStatsDto> {
    // 플랫폼 통계 서비스들을 활용하여 상세 통계 구성
    const platformStatsRecord = await this.creatorPlatformStatisticsService.groupPlatformStatsByCreatorId([creatorId]);
    const platformStats = platformStatsRecord[creatorId];
    
    if (!platformStats || platformStats.length === 0) {
      return {
        totalFollowers: 0,
        totalContent: 0,
        totalViews: 0,
        platformCount: 0,
      };
    }

    // 배열의 통계를 집계
    const totalFollowers = platformStats.reduce((sum, stat) => sum + (stat.followers || 0), 0);
    const totalContent = platformStats.reduce((sum, stat) => sum + (stat.content || 0), 0);
    const totalViews = platformStats.reduce((sum, stat) => sum + Number(stat.views || 0), 0);

    return {
      totalFollowers,
      totalContent,
      totalViews,
      platformCount: platformStats.length,
    };
  }
}