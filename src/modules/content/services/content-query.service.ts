import { Injectable, Logger, HttpException } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { CacheService } from '@database/redis/index.js';
import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentRepository } from '../repositories/index.js';
import { ContentEntity } from '../entities/index.js';
import { ContentException } from '../exceptions/index.js';
import { UserInteractionEntity } from '../../user-interaction/entities/index.js';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  ContentDetailDto,
  TrendingContentDto,
} from '../dto/index.js';

import { ContentService } from './content.service.js';

@Injectable()
export class ContentQueryService {
  private readonly logger = new Logger(ContentQueryService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly contentService: ContentService,
    private readonly userInteractionService: UserInteractionService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async searchContent(
    query: ContentSearchQueryDto,
    userId?: string
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    try {
      const searchOptions = {
        creatorId: query.creatorId || undefined,
        creatorIds: query.creatorIds,
        type: query.type,
        platform: query.platform,
        category: query.category,
        tags: query.tags,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page || 1,
        limit: query.limit || 30,
        sortBy: query.sortBy || 'publishedAt',
        sortOrder: query.sortOrder || 'DESC',
      };

      const result = await this.contentRepo.searchContent(searchOptions);

      if (result.items.length === 0) {
        return { items: [], pageInfo: result.pageInfo };
      }

      // 사용자별 상호작용 데이터 조회
      let userInteractions: Record<string, UserInteractionEntity> = {};
      if (userId) {
        const contentIds = result.items.map((item) => item.id!);
        userInteractions = await this.userInteractionService.getContentInteractionsBatch(
          contentIds,
          userId
        );
      }

      const searchResults = this.buildContentSearchResults(result.items, userInteractions);

      this.logger.debug('Content search completed', {
        totalFound: result.pageInfo.totalItems,
        page: query.page,
        limit: query.limit,
        hasUserContext: !!userId,
        platform: query.platform,
        creatorId: query.creatorId,
      });

      return {
        items: searchResults,
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      this.logger.error('Content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        userId,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentById(contentId: string, userId?: string): Promise<ContentDetailDto> {
    try {
      // 1. 캐시에서 기본 콘텐츠 정보 조회
      let cached = await this.cacheService.getContentDetail(contentId);
      if (!cached) {
        const content = await this.contentService.findByIdOrFail(contentId);
        cached = this.buildContentDetail(content);
        await this.cacheService.setContentDetail(contentId, cached);
      }

      // 2. 사용자별 상호작용 데이터 추가
      if (userId) {
        const userInteraction = await this.userInteractionService.getInteractionDetail(userId, contentId);
        if (userInteraction) {
          cached.isBookmarked = userInteraction.isBookmarked;
          cached.isLiked = userInteraction.isLiked;
          if (userInteraction.watchedAt) {
            cached.watchedAt = userInteraction.watchedAt;
          }
          if (userInteraction.watchDuration !== null && userInteraction.watchDuration !== undefined) {
            cached.watchDuration = userInteraction.watchDuration;
          }
          if (userInteraction.rating !== null && userInteraction.rating !== undefined) {
            cached.rating = userInteraction.rating;
          }
        }
      }

      this.logger.debug('Content detail fetched', {
        contentId,
        title: cached.title,
        hasUserContext: !!userId,
      });

      return cached;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTrendingContent(
    platform?: string,
    category?: string,
    limit: number = 20
  ): Promise<TrendingContentDto[]> {
    try {
      const cacheKey = `trending:${platform || 'all'}:${category || 'all'}:${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug('Trending content served from cache', {
          platform,
          category,
          count: cached.length,
        });
        return cached;
      }

      const content = await this.contentRepo.getTrendingContent(24, limit);

      const trendingResults = this.buildTrendingResults(content);
      await this.cacheService.set(cacheKey, trendingResults, 3600);

      this.logger.debug('Trending content fetched and cached', {
        platform,
        category,
        count: content.length,
        limit,
      });

      return trendingResults;
    } catch (error: unknown) {
      this.logger.error('Trending content fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
        category,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentFeed(
    creatorIds: string[],
    page: number = 1,
    limit: number = 20,
    userId?: string
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    try {
      if (creatorIds.length === 0) {
        const limitType = limit <= 15 ? LimitType.FIFTEEN : 
                         limit <= 30 ? LimitType.THIRTY : 
                         limit <= 50 ? LimitType.FIFTY : LimitType.HUNDRED;
        return { items: [], pageInfo: { page, limit: limitType, totalPages: 0, totalItems: 0, hasPreviousPage: false, hasNextPage: false } };
      }

      const items = await this.contentRepo.getRecentContent(creatorIds, limit);

      let userInteractions: Record<string, UserInteractionEntity> = {};
      if (userId && items.length > 0) {
        const contentIds = items.map((item) => item.id);
        userInteractions = await this.userInteractionService.getContentInteractionsBatch(
          contentIds,
          userId
        );
      }

      const searchResults = this.buildContentSearchResults(items, userInteractions);

      const totalItems = items.length;
      const totalPages = Math.ceil(totalItems / limit);

      this.logger.debug('Content feed fetched', {
        creatorCount: creatorIds.length,
        totalFound: totalItems,
        page,
        limit,
        hasUserContext: !!userId,
      });

      const limitType = limit <= 15 ? LimitType.FIFTEEN : 
                       limit <= 30 ? LimitType.THIRTY : 
                       limit <= 50 ? LimitType.FIFTY : LimitType.HUNDRED;

      return {
        items: searchResults,
        pageInfo: {
          page,
          limit: limitType,
          totalPages,
          totalItems,
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Content feed fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
        page,
        limit,
        userId,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 캐시 관리 메서드 ====================

  async invalidateContentCache(contentId: string): Promise<void> {
    await this.cacheService.invalidateContentRelatedCaches(contentId);
    this.logger.debug('Content cache invalidated', { contentId });
  }

  async refreshContentCache(contentId: string): Promise<void> {
    await this.invalidateContentCache(contentId);
    await this.getContentById(contentId);
    this.logger.debug('Content cache refreshed', { contentId });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private buildContentSearchResults(
    content: Partial<ContentEntity>[],
    userInteractions: Record<string, UserInteractionEntity> = {}
  ): ContentSearchResultDto[] {
    return content.map((item) => {
      const contentWithStats = item as Partial<ContentEntity> & { 
        statistics?: {
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagementRate: number;
          updatedAt: Date;
        };
      };
      
      return plainToInstance(ContentSearchResultDto, {
        ...item,
        statistics: contentWithStats.statistics || {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          engagementRate: 0,
          updatedAt: new Date(),
        },
        userInteraction: userInteractions[item.id!] || null,
      }, {
        excludeExtraneousValues: true,
      });
    });
  }

  private buildContentDetail(content: ContentEntity): ContentDetailDto {
    const result: ContentDetailDto = {
      id: content.id,
      type: content.type,
      title: content.title,
      thumbnail: content.thumbnail,
      url: content.url,
      platform: content.platform,
      platformId: content.platformId,
      publishedAt: content.publishedAt,
      creatorId: content.creatorId,
      isLive: content.isLive,
      ageRestriction: content.ageRestriction,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      creator: {
        id: content.creatorId,
        name: '',
        displayName: '',
        isVerified: false,
        followerCount: 0,
        category: '',
      },
      statistics: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        updatedAt: new Date(),
      },
    };

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (content.description !== undefined && content.description !== null) {
      result.description = content.description;
    }
    if (content.duration !== undefined && content.duration !== null) {
      result.duration = content.duration;
    }
    if (content.language !== undefined && content.language !== null) {
      result.language = content.language;
    }
    if (content.quality !== undefined && content.quality !== null) {
      result.quality = content.quality;
    }

    return result;
  }

  private buildTrendingResults(content: ContentEntity[]): TrendingContentDto[] {
    return content.map((item) =>
      plainToInstance(TrendingContentDto, item, {
        excludeExtraneousValues: true,
      })
    );
  }
}