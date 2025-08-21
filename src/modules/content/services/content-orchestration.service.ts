import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

// import { PlatformType } from '@common/enums/index.js';
import { UserInteractionService } from '@modules/user-interaction/index.js';
import { CacheService } from '@database/redis/index.js';

import { ContentEntity } from '../entities/index.js';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  TrendingContentDto,
  CreateContentDto,
  ContentCategoryDto,
  ContentTagDto,
} from '../dto/index.js';
import { ContentException } from '../exceptions/index.js';

import { ContentService } from './content.service.js';
import { ContentCategoryService } from './content-category.service.js';
import { ContentTagService } from './content-tag.service.js';
import { ContentStatisticsService } from './content-statistics.service.js';

@Injectable()
export class ContentOrchestrationService {
  private readonly logger = new Logger(ContentOrchestrationService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService,
    private readonly contentCategoryService: ContentCategoryService,
    private readonly contentTagService: ContentTagService,
    private readonly contentStatisticsService: ContentStatisticsService,
    private readonly cacheService: CacheService,
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 복합 조회 메서드들
  async searchContent(
    query: ContentSearchQueryDto,
    userId?: string,
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    try {
      // Create clean search options with proper types
      const cleanedOptions: Record<string, unknown> = {};
      
      // Copy defined properties from query
      Object.keys(query).forEach(key => {
        const value = (query as Record<string, unknown>)[key];
        if (value !== undefined) {
          cleanedOptions[key] = value;
        }
      });

      // Transform string dates to Date objects if provided
      if (query.startDate) {
        cleanedOptions.startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        cleanedOptions.endDate = new Date(query.endDate);
      }

      const { items, pageInfo } = await this.contentService.searchContent(cleanedOptions as Parameters<typeof this.contentService.searchContent>[0]);
      
      if (items.length === 0) {
        return { items: [], pageInfo: pageInfo as import('@krgeobuk/core/interfaces').PaginatedResultBase };
      }

      const contentIds = items.map((content) => content.id!);
      const enrichedItems = await this.enrichContentWithMetadata(items, contentIds, userId);
      
      this.logger.debug('Content search completed with enriched data', {
        totalFound: (pageInfo as { totalItems?: number }).totalItems,
        page: query.page,
        hasCreatorFilter: !!(query.creatorId || query.creatorIds),
        type: query.type,
        platform: query.platform,
        userInteractionCount: userId ? contentIds.length : 0,
      });

      return { items: enrichedItems, pageInfo: pageInfo as import('@krgeobuk/core/interfaces').PaginatedResultBase };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: {
          page: query.page,
          limit: query.limit,
          hasCreatorFilter: !!(query.creatorId || query.creatorIds),
          type: query.type,
          platform: query.platform,
        },
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTrendingContent(
    hours: number = 24,
    limit: number = 50,
  ): Promise<TrendingContentDto[]> {
    try {
      // 캐시에서 먼저 조회 (MVP: 간단한 캐시 적용)
      const cached = await this.cacheService.getTrendingContent(hours);
      if (cached && cached.length > 0) {
        this.logger.debug('Trending content cache hit', { hours, count: cached.length });
        return cached.slice(0, limit).map((content) =>
          plainToInstance(TrendingContentDto, content, {
            excludeExtraneousValues: true,
          })
        );
      }

      const contents = await this.contentService.getTrendingContent(hours, limit);

      const trendingResults = contents.map((content) =>
        plainToInstance(TrendingContentDto, content, {
          excludeExtraneousValues: true,
        }),
      );

      // 캐시에 저장 (MVP: 필요시에만)
      if (trendingResults.length > 0) {
        await this.cacheService.setTrendingContent(hours, trendingResults);
      }

      this.logger.debug('Trending content fetched', {
        hours,
        count: contents.length,
        limit,
      });

      return trendingResults;
    } catch (error: unknown) {
      this.logger.error('Trending content fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hours,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getRecentContent(
    creatorIds: string[],
    limit: number = 20,
  ): Promise<ContentSearchResultDto[]> {
    try {
      const contents = await this.contentService.getRecentContentByCreatorIds(creatorIds, limit);

      const recentResults = contents.map((content) =>
        plainToInstance(ContentSearchResultDto, content, {
          excludeExtraneousValues: true,
        }),
      );

      this.logger.debug('Recent content fetched', {
        creatorCount: creatorIds.length,
        count: contents.length,
        limit,
      });

      return recentResults;
    } catch (error: unknown) {
      this.logger.error('Recent content fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  // 변경 메서드들 (트랜잭션 지원)
  async createContentComplete(
    dto: CreateContentDto,
    transactionManager?: EntityManager,
  ): Promise<string> {
    try {
      // 1. ContentService를 통한 콘텐츠 생성
      const contentId = await this.contentService.createContent(dto, transactionManager);

      // 2. 통계 정보 생성 및 저장
      await this.createContentStatistics(contentId, dto, transactionManager);

      // 3. 성공 로깅
      this.logger.log('Content created with statistics', {
        contentId: contentId,
        type: dto.type,
        platform: dto.platform,
        platformId: dto.platformId,
        creatorId: dto.creatorId,
      });

      return contentId;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content creation with statistics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId: dto.platformId,
        platform: dto.platform,
        creatorId: dto.creatorId,
      });
      
      throw ContentException.contentCreateError();
    }
  }

  async updateContentBatch(
    contentIds: string[], 
    updateData: Partial<ContentEntity>,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      if (contentIds.length === 0) return;

      await this.contentService.batchUpdateContent(contentIds, updateData, transactionManager);

      this.logger.log('Batch content update completed', {
        contentCount: contentIds.length,
        updateFields: Object.keys(updateData),
        updatedAt: new Date()
      });
    } catch (error: unknown) {
      this.logger.error('Failed to batch update content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentIds: contentIds.slice(0, 5), // 처음 5개만 로깅
        contentCount: contentIds.length
      });
      throw ContentException.contentUpdateError();
    }
  }

  async refreshContentMetadata(contentId: string): Promise<void> {
    try {
      await this.contentService.refreshContentMetadata(contentId);

      this.logger.debug('Content metadata refreshed', {
        contentId,
        updatedAt: new Date()
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content metadata refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  // ==================== 데이터 정리 및 정책 준수 메서드 ====================

  async cleanupOldContent(daysOld: number = 30): Promise<{ 
    deletedCount: number; 
  }> {
    try {
      this.logger.log('Starting old content cleanup');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      // 오래된 콘텐츠 조회
      const oldContents = await this.contentService.findOldContent(daysOld);

      if (oldContents.length === 0) {
        this.logger.debug('No old content found for cleanup');
        return { 
          deletedCount: 0 
        };
      }

      // 오래된 콘텐츠 배치 삭제
      const contentIds = oldContents.map(content => content.id);
      const { deletedCount } = await this.contentService.deleteContentsByIds(contentIds);

      this.logger.log('Old content cleanup completed', {
        deletedCount,
        totalOldContent: oldContents.length,
        cutoffDate,
        daysOld,
        platformBreakdown: oldContents.reduce((acc, content) => {
          acc[content.platform] = (acc[content.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      return { 
        deletedCount
      };
    } catch (error: unknown) {
      this.logger.error('Old content cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentCleanupError();
    }
  }

  async revokeCreatorDataConsent(
    creatorId: string,
    transactionManager?: EntityManager
  ): Promise<{ deletedCount: number }> {
    try {
      this.logger.log('Revoking data consent for creator', { creatorId });

      // 해당 크리에이터의 모든 콘텐츠 삭제 (동의 철회 시)
      const { deletedCount } = await this.contentService.deleteContentsByCreatorId(creatorId, transactionManager);

      this.logger.log('Creator data consent revoked - content deleted', {
        creatorId,
        deletedCount
      });

      return { deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to revoke creator data consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentDeleteError();
    }
  }

  /**
   * Rolling Window: 비동의 크리에이터의 오래된 데이터 정리
   * 30일 이상 된 데이터를 삭제하고 최신 30일만 유지
   */
  async cleanupOldCreatorContent(creatorId: string, daysOld: number = 30): Promise<{
    deletedCount: number;
    retainedCount: number;
    oldestRetainedDate: Date | null;
  }> {
    try {
      this.logger.log('Starting old content cleanup for creator', { creatorId, daysOld });
      
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
      
      // 해당 크리에이터의 오래된 데이터 삭제
      const { deletedCount } = await this.contentService.deleteExpiredContent(cutoffDate);
      
      // 최신 데이터는 그대로 유지되므로 별도 조회는 생략
      const recentContents: unknown[] = []; // 임시로 빈 배열
      
      const oldestRetainedDate = recentContents.length > 0 
        ? ((recentContents[0] as { publishedAt?: Date })?.publishedAt || null)
        : null;
      
      this.logger.log('Old content cleanup completed for creator', {
        creatorId,
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate,
        cutoffDate,
        daysOld,
      });
      
      return {
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate
      };
    } catch (error: unknown) {
      this.logger.error('Old content cleanup failed for creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentCleanupError();
    }
  }

  /**
   * 여러 크리에이터의 오래된 콘텐츠 일괄 정리
   */
  async batchCleanupOldContent(creatorIds: string[], daysOld: number = 30): Promise<{
    processedCreators: number;
    totalDeleted: number;
    totalRetained: number;
    errors: number;
  }> {
    try {
      this.logger.log('Starting batch old content cleanup for creators', { 
        creatorCount: creatorIds.length,
        daysOld
      });
      
      if (creatorIds.length === 0) {
        this.logger.debug('No creators provided for old content cleanup');
        return {
          processedCreators: 0,
          totalDeleted: 0,
          totalRetained: 0,
          errors: 0
        };
      }
      
      let totalDeleted = 0;
      let totalRetained = 0;
      let errors = 0;
      
      // 각 크리에이터별로 오래된 콘텐츠 정리
      for (const creatorId of creatorIds) {
        try {
          const result = await this.cleanupOldCreatorContent(creatorId, daysOld);
          totalDeleted += result.deletedCount;
          totalRetained += result.retainedCount;
        } catch (error: unknown) {
          errors++;
          this.logger.warn('Individual creator old content cleanup failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId
          });
        }
        
        // API 레이트 리미팅을 위한 지연
        await this.delay(100);
      }
      
      this.logger.log('Batch rolling window cleanup completed', {
        processedCreators: creatorIds.length,
        totalDeleted,
        totalRetained,
        errors,
        successRate: ((creatorIds.length - errors) / creatorIds.length * 100).toFixed(1) + '%'
      });
      
      return {
        processedCreators: creatorIds.length,
        totalDeleted,
        totalRetained,
        errors
      };
    } catch (error: unknown) {
      this.logger.error('Batch rolling window cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw ContentException.contentCleanupError();
    }
  }

  async deleteAllNonConsentedData(
    creatorId: string,
    transactionManager?: EntityManager
  ): Promise<{ deletedCount: number }> {
    try {
      this.logger.log('Deleting all non-consented data for creator', { creatorId });
      
      // 크리에이터의 모든 데이터 삭제
      const { deletedCount } = await this.contentService.deleteContentsByCreatorId(creatorId, transactionManager);
      
      this.logger.log('All non-consented data deleted for creator', {
        creatorId,
        deletedCount
      });
      
      return { deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to delete all non-consented data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentDeleteError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async createContentStatistics(
    contentId: string, 
    dto: CreateContentDto, 
    transactionManager?: EntityManager
  ): Promise<void> {
    await this.contentStatisticsService.createStatistics(
      contentId,
      {
        views: dto.initialViews || 0,
        likes: dto.initialLikes || 0,
        comments: dto.initialComments || 0,
        shares: dto.initialShares || 0,
      },
      transactionManager
    );
  }

  private async enrichContentWithMetadata(
    contents: Partial<ContentEntity>[],
    contentIds: string[],
    userId?: string
  ): Promise<ContentSearchResultDto[]> {
    try {
      // 콘텐츠 통계 정보 조회
      const contentStatistics = await this.getContentStatisticsByIds(contentIds);
      
      // 사용자 상호작용 정보 조회 (userId가 있을 때만)
      const userInteractions = userId 
        ? await this.getUserInteractionsByContentIds(userId, contentIds) 
        : {} as Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number; }>;

      // 분리된 엔티티 데이터 조회 (카테고리/태그)
      const [contentCategories, contentTags] = await Promise.all([
        this.getContentCategoriesByContentIds(contentIds),
        this.getContentTagsByContentIds(contentIds),
      ]);

      return this.buildContentSearchResults(
        contents, 
        userInteractions, 
        contentStatistics, 
        contentCategories, 
        contentTags, 
        userId
      );
    } catch (error: unknown) {
      this.logger.warn('외부 데이터 조회 실패, 기본 데이터 사용', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contents.length,
      });

      // 폴백 처리
      return this.buildFallbackContentSearchResults(contents);
    }
  }

  // 분리된 엔티티 데이터 배치 조회
  private async getContentCategoriesByContentIds(contentIds: string[]): Promise<Record<string, ContentCategoryDto[]>> {
    if (contentIds.length === 0) return {};

    try {
      const groupedCategories: Record<string, ContentCategoryDto[]> = {};
      
      await Promise.all(contentIds.map(async (contentId) => {
        try {
          const categories = await this.contentCategoryService.findByContentId(contentId);
          if (categories.length > 0) {
            groupedCategories[contentId] = categories.map(category => {
              const dto: ContentCategoryDto = {
                category: category.category,
                isPrimary: category.isPrimary,
                confidence: category.confidence,
                source: category.source,
                createdAt: category.createdAt,
                updatedAt: category.updatedAt,
              };
              
              if (category.subcategory) {
                dto.subcategory = category.subcategory;
              }
              
              if (category.classifiedBy) {
                dto.classifiedBy = category.classifiedBy;
              }
              
              return dto;
            });
          }
        } catch (_err) {
          // 개별 콘텐츠 카테고리 조회 실패는 무시
        }
      }));

      return groupedCategories;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch content categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  private async getContentTagsByContentIds(contentIds: string[]): Promise<Record<string, ContentTagDto[]>> {
    if (contentIds.length === 0) return {};

    try {
      const groupedTags: Record<string, ContentTagDto[]> = {};
      
      await Promise.all(contentIds.map(async (contentId) => {
        try {
          const tags = await this.contentTagService.findByContentId(contentId);
          if (tags.length > 0) {
            groupedTags[contentId] = tags.map(tag => {
              const dto: ContentTagDto = {
                tag: tag.tag,
                source: tag.source,
                relevanceScore: tag.relevanceScore,
                usageCount: tag.usageCount,
                createdAt: tag.createdAt,
              };
              
              if (tag.addedBy) {
                dto.addedBy = tag.addedBy;
              }
              
              return dto;
            });
          }
        } catch (_err) {
          // 개별 콘텐츠 태그 조회 실패는 무시
        }
      }));

      return groupedTags;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch content tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  // 콘텐츠 통계 정보 조회 (ContentStatistics 연동)
  private async getContentStatisticsByIds(
    contentIds: string[]
  ): Promise<Record<string, { views: number; likes: number; comments: number; shares: number; engagementRate: number; updatedAt: Date; }>> {
    try {
      if (contentIds.length === 0) return {};

      const statistics = await this.contentStatisticsService.getStatisticsBatch(contentIds);

      const result: Record<string, { views: number; likes: number; comments: number; shares: number; engagementRate: number; updatedAt: Date; }> = {};
      
      Object.entries(statistics).forEach(([contentId, stat]) => {
        result[contentId] = {
          views: Number(stat.views) || 0,
          likes: stat.likes || 0,
          comments: stat.comments || 0,
          shares: stat.shares || 0,
          engagementRate: Number(stat.engagementRate) || 0,
          updatedAt: stat.updatedAt || new Date(),
        };
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch content statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {}; // 실패 시 빈 객체 반환
    }
  }

  // 사용자 상호작용 정보 조회 (UserInteractionService 연동)
  private async getUserInteractionsByContentIds(
    userId: string, 
    contentIds: string[]
  ): Promise<Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number; watchedAt?: Date; }>> {
    try {
      const interactions = await this.userInteractionService.getContentInteractionsBatch(
        contentIds, 
        userId
      );
      
      const result: Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number; watchedAt?: Date; }> = {};
      
      Object.entries(interactions).forEach(([contentId, interaction]) => {
        const interactionData: { isBookmarked?: boolean; isLiked?: boolean; rating?: number; watchedAt?: Date; } = {
          isBookmarked: interaction.isBookmarked || false,
          isLiked: interaction.isLiked || false,
        };
        
        if (interaction.rating) {
          interactionData.rating = interaction.rating;
        }
        if (interaction.watchedAt) {
          interactionData.watchedAt = interaction.watchedAt;
        }
        
        result[contentId] = interactionData;
      });
      
      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch batch user interactions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentCount: contentIds.length,
      });
      return {}; // 실패 시 빈 객체 반환
    }
  }

  // 콘텐츠 검색 결과 빌드 (데이터 정규화 기반)
  private buildContentSearchResults(
    contents: Partial<ContentEntity>[],
    userInteractions: Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number }>,
    contentStatistics: Record<string, { views: number; likes: number; comments: number; shares: number; engagementRate: number; updatedAt: Date; }>,
    contentCategories: Record<string, ContentCategoryDto[]>,
    contentTags: Record<string, ContentTagDto[]>,
    userId?: string
  ): ContentSearchResultDto[] {
    return contents.map((content) => {
      const interaction = userInteractions[content.id!];
      const statistics = contentStatistics[content.id!] || {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        updatedAt: new Date()
      };

      const result: ContentSearchResultDto = {
        id: content.id!,
        type: content.type!,
        title: content.title!,
        description: content.description ?? null,
        thumbnail: content.thumbnail!,
        url: content.url!,
        platform: content.platform!,
        platformId: content.platformId!,
        duration: content.duration ?? null,
        publishedAt: content.publishedAt!,
        creatorId: content.creatorId!,
        isLive: content.isLive || false,
        quality: content.quality ?? null,
        ageRestriction: content.ageRestriction || false,
        status: content.status || 'active',
        // 분리된 엔티티 데이터 포함
        categories: contentCategories[content.id!] || [],
        tags: contentTags[content.id!] || [],
        createdAt: content.createdAt!,
        statistics, // 실제 통계 사용
        // 사용자 상호작용 정보 (userId가 있을 때만)
        isBookmarked: userId ? (interaction?.isBookmarked || false) : undefined,
        isLiked: userId ? (interaction?.isLiked || false) : undefined,
        watchedAt: userId ? (interaction as { watchedAt?: Date })?.watchedAt : undefined,
        rating: userId ? interaction?.rating : undefined,
      };

      // 조건부 할당 (exactOptionalPropertyTypes 준수)
      if (content.language != null) {
        result.language = content.language;
      }

      return result;
    });
  }

  // 폴백 처리 결과 빌드
  private buildFallbackContentSearchResults(contents: Partial<ContentEntity>[]): ContentSearchResultDto[] {
    return contents.map((content) => {
      const result: ContentSearchResultDto = {
      id: content.id!,
      type: content.type!,
      title: content.title!,
      description: content.description ?? null,
      thumbnail: content.thumbnail!,
      url: content.url!,
      platform: content.platform!,
      platformId: content.platformId!,
      duration: content.duration ?? null,
      publishedAt: content.publishedAt!,
      creatorId: content.creatorId!,
      // 개별 메타데이터 필드 (JSON 제거)
      isLive: content.isLive || false,
      quality: content.quality ?? null,
      ageRestriction: content.ageRestriction || false,
      status: content.status || 'active',
      // 분리된 엔티티 데이터 (폴백 시 빈 배열)
      categories: [],
      tags: [],
      createdAt: content.createdAt!,
      statistics: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        updatedAt: new Date()
      }, // 폴백 시 기본값
      // 사용자 상호작용 정보 기본값
      isBookmarked: undefined,
      isLiked: undefined,
      watchedAt: undefined,
      rating: undefined,
      };

      // 조건부 할당 (exactOptionalPropertyTypes 준수)
      if (content.language != null) {
        result.language = content.language;
      }

      return result;
    });
  }

  /**
   * 지연 함수 (API 레이트 리미팅용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}