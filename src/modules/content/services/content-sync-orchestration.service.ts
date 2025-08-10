import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';


import { ContentException } from '../exceptions/index.js';
import { CreateContentDto, UpdateContentDto, UpdateContentStatisticsDto } from '../dto/index.js';

import { ContentService } from './content.service.js';
import { ContentQueryService } from './content-query.service.js';
import { ContentCategoryService } from './content-category.service.js';
import { ContentTagService } from './content-tag.service.js';


@Injectable()
export class ContentSyncOrchestrationService {
  private readonly logger = new Logger(ContentSyncOrchestrationService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly contentQueryService: ContentQueryService,
    private readonly contentCategoryService: ContentCategoryService,
    private readonly contentTagService: ContentTagService
  ) {}

  // ==================== 콘텐츠 생성 오케스트레이션 ====================

  async createContentWithMetadata(
    dto: CreateContentDto,
    hasCreatorConsent: boolean = false,
    transactionManager?: EntityManager
  ): Promise<string> {
    try {
      this.logger.log('Starting content creation with metadata', {
        title: dto.title,
        platform: dto.platform,
        creatorId: dto.creatorId,
        hasCreatorConsent,
      });

      // 1. 동의 상태에 따른 만료일 설정
      const now = new Date();
      const expiresAt = hasCreatorConsent
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 동의한 경우: 1년
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 비동의: 30일

      const contentDto: CreateContentDto = {
        ...dto,
        lastSyncedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isAuthorizedData: hasCreatorConsent,
      };

      // 2. 콘텐츠 생성
      const contentId = await this.contentService.createContent(contentDto, transactionManager);

      // 3. 카테고리 처리
      if (dto.categories && dto.categories.length > 0) {
        await this.contentCategoryService.assignCategoriesToContent(
          contentId, 
          dto.categories.map(cat => ({ category: typeof cat === 'string' ? cat : cat.category, confidence: 0.9, source: 'platform' as const }))
        );
      }

      // 4. 태그 처리
      if (dto.tags && dto.tags.length > 0) {
        await this.contentTagService.assignTagsToContent(
          contentId,
          dto.tags.map(tag => ({ tag: typeof tag === 'string' ? tag : tag.tag, relevanceScore: 0.9, source: 'platform' as const }))
        );
      }

      // 5. 캐시 무효화
      await this.contentQueryService.invalidateContentCache(contentId);

      this.logger.log('Content created with metadata', {
        contentId,
        title: dto.title,
        platform: dto.platform,
        creatorId: dto.creatorId,
        categoryCount: dto.categories?.length || 0,
        tagCount: dto.tags?.length || 0,
        hasCreatorConsent,
        expiresAt: expiresAt.toISOString(),
      });

      return contentId;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content creation with metadata failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        title: dto.title,
        platform: dto.platform,
        creatorId: dto.creatorId,
      });
      throw ContentException.contentCreateError();
    }
  }

  async updateContentWithMetadata(
    contentId: string,
    dto: UpdateContentDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 콘텐츠 업데이트
      await this.contentService.updateContent(contentId, dto, transactionManager);

      // 2. 메타데이터 업데이트
      if (dto.categories !== undefined) {
        if (dto.categories.length > 0) {
          await this.contentCategoryService.assignCategoriesToContent(
            contentId, 
            dto.categories.map(cat => ({ category: typeof cat === 'string' ? cat : cat.category, confidence: 0.9, source: 'platform' as const }))
          );
        } else {
          await this.contentCategoryService.removeContentCategories(contentId);
        }
      }

      if (dto.tags !== undefined) {
        if (dto.tags.length > 0) {
          await this.contentTagService.assignTagsToContent(
            contentId,
            dto.tags.map(tag => ({ tag: typeof tag === 'string' ? tag : tag.tag, relevanceScore: 0.9, source: 'platform' as const }))
          );
        } else {
          await this.contentTagService.removeContentTags(contentId);
        }
      }

      // 3. 캐시 갱신
      await this.contentQueryService.refreshContentCache(contentId);

      this.logger.log('Content updated with metadata', {
        contentId,
        updatedFields: Object.keys(dto),
        hasCategoryUpdate: dto.categories !== undefined,
        hasTagUpdate: dto.tags !== undefined,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content update with metadata failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        updatedFields: Object.keys(dto),
      });
      throw ContentException.contentUpdateError();
    }
  }

  async deleteContentComplete(contentId: string): Promise<void> {
    try {
      this.logger.log('Starting complete content deletion', { contentId });

      // 1. 메타데이터 제거
      await this.contentCategoryService.removeContentCategories(contentId);
      await this.contentTagService.removeContentTags(contentId);

      // 2. 콘텐츠 삭제
      await this.contentService.deleteContent(contentId);

      // 3. 캐시 무효화
      await this.contentQueryService.invalidateContentCache(contentId);

      this.logger.log('Content deletion completed', { contentId });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Complete content deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  // ==================== 통계 업데이트 오케스트레이션 ====================

  async updateContentStatisticsWithCache(
    contentId: string,
    statistics: UpdateContentStatisticsDto
  ): Promise<void> {
    try {
      // 1. 통계 업데이트
      await this.contentService.updateContentStatistics(contentId, statistics);

      // 2. 관련 캐시 무효화 (트렌딩 콘텐츠, 피드 캐시 등)
      await this.contentQueryService.invalidateContentCache(contentId);

      this.logger.debug('Content statistics updated with cache refresh', {
        contentId,
        views: statistics.views,
        likes: statistics.likes,
        comments: statistics.comments,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content statistics update with cache refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        statistics,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async refreshContentMetadataWithSync(contentId: string): Promise<void> {
    try {
      const content = await this.contentService.findByIdOrFail(contentId);

      // 메타데이터 갱신 (lastSyncedAt는 별도 처리 필요)
      // TODO: lastSyncedAt 필드는 ContentEntity 스키마에 추가하거나 별도 메서드로 처리

      // 캐시 갱신
      await this.contentQueryService.refreshContentCache(contentId);

      this.logger.debug('Content metadata refreshed with sync timestamp', {
        contentId,
        title: content.title,
        platform: content.platform,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content metadata refresh with sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  // ==================== 배치 처리 오케스트레이션 ====================

  async batchCreateContentWithMetadata(
    contents: Array<{
      dto: CreateContentDto;
      hasCreatorConsent: boolean;
    }>,
    transactionManager?: EntityManager
  ): Promise<string[]> {
    try {
      this.logger.log('Starting batch content creation', {
        contentCount: contents.length,
      });

      const createdIds: string[] = [];

      for (const { dto, hasCreatorConsent } of contents) {
        try {
          const contentId = await this.createContentWithMetadata(
            dto,
            hasCreatorConsent,
            transactionManager
          );
          createdIds.push(contentId);
        } catch (error: unknown) {
          this.logger.warn('Batch content creation: individual item failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            title: dto.title,
            platform: dto.platform,
            creatorId: dto.creatorId,
          });
        }
      }

      this.logger.log('Batch content creation completed', {
        totalRequested: contents.length,
        successfullyCreated: createdIds.length,
        failureCount: contents.length - createdIds.length,
      });

      return createdIds;
    } catch (error: unknown) {
      this.logger.error('Batch content creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contents.length,
      });
      throw ContentException.contentCreateError();
    }
  }

  async batchUpdateContentStatistics(
    updates: Array<{
      contentId: string;
      statistics: UpdateContentStatisticsDto;
    }>
  ): Promise<void> {
    try {
      this.logger.log('Starting batch content statistics update', {
        updateCount: updates.length,
      });

      let successCount = 0;
      let failureCount = 0;

      for (const { contentId, statistics } of updates) {
        try {
          await this.updateContentStatisticsWithCache(contentId, statistics);
          successCount++;
        } catch (error: unknown) {
          failureCount++;
          this.logger.warn('Batch statistics update: individual item failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            contentId,
            statistics,
          });
        }
      }

      this.logger.log('Batch content statistics update completed', {
        totalRequested: updates.length,
        successCount,
        failureCount,
      });
    } catch (error: unknown) {
      this.logger.error('Batch content statistics update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updateCount: updates.length,
      });
      throw ContentException.contentUpdateError();
    }
  }
}