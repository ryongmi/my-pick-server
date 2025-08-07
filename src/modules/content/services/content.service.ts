import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager, UpdateResult, In, FindOptionsWhere, LessThan, MoreThan, And, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { PlatformType } from '@common/enums/index.js';
import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentRepository } from '../repositories/index.js';
import { ContentEntity, ContentStatisticsEntity } from '../entities/index.js';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  ContentDetailDto,
  CreateContentDto,
  UpdateContentDto,
  UpdateContentStatisticsDto,
  ContentCategoryDto,
  ContentTagDto,
} from '../dto/index.js';
import { ContentException } from '../exceptions/index.js';
import { ContentCategoryService } from './content-category.service.js';
import { ContentTagService } from './content-tag.service.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly dataSource: DataSource,
    private readonly userInteractionService: UserInteractionService,
    private readonly contentCategoryService: ContentCategoryService,
    private readonly contentTagService: ContentTagService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들 (BaseRepository 직접 사용)
  async findById(contentId: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOneById(contentId);
  }

  async findByIds(contentIds: string[]): Promise<ContentEntity[]> {
    if (contentIds.length === 0) return [];

    return this.contentRepo.find({
      where: { id: In(contentIds) },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByCreatorId(creatorId: string): Promise<ContentEntity[]> {
    return this.contentRepo.find({
      where: { creatorId },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByCreatorIds(creatorIds: string[]): Promise<ContentEntity[]> {
    if (creatorIds.length === 0) return [];
    
    return this.contentRepo.find({
      where: { creatorId: In(creatorIds) },
      order: { publishedAt: 'DESC' },
    });
  }

  async findByPlatformId(platformId: string, platform: string): Promise<ContentEntity | null> {
    return this.contentRepo.findOne({
      where: { platformId, platform: platform as PlatformType },
    });
  }

  async findByIdOrFail(contentId: string): Promise<ContentEntity> {
    const content = await this.findById(contentId);
    if (!content) {
      this.logger.warn('Content not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return content;
  }

  // 중복 메서드 제거됨 - BaseRepository 직접 사용 메서드로 대체

  // 복합 조회 메서드들
  async searchContent(
    query: ContentSearchQueryDto,
    userId?: string,
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
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

    const { items, pageInfo } = await this.contentRepo.searchContent(cleanedOptions as Parameters<typeof this.contentRepo.searchContent>[0]);
    
    if (items.length === 0) {
      return { items: [], pageInfo };
    }

    const contentIds = items.map((content) => content.id!);
    const creatorIds = [...new Set(items.map((content) => content.creatorId!))]; // 중복 제거

    try {
      // 🔥 콘텐츠 통계 정보 조회
      const contentStatistics = await this.getContentStatisticsByIds(contentIds);
      
      // 🔥 사용자 상호작용 정보 조회 (크리에이터 정보는 실시간 집계로 대체)
      const userInteractions = userId ? await this.getUserInteractionsByContentIds(userId, contentIds) : {} as Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number; }>;

      // 🔥 분리된 엔티티 데이터 조회 (카테고리/태그)
      const [contentCategories, contentTags] = await Promise.all([
        this.getContentCategoriesByContentIds(contentIds),
        this.getContentTagsByContentIds(contentIds),
      ]);

      const enrichedItems = this.buildContentSearchResults(items, userInteractions, contentStatistics, contentCategories, contentTags, userId);
      
      this.logger.debug('Content search completed with enriched data', {
        totalFound: pageInfo.totalItems,
        page: query.page,
        hasCreatorFilter: !!(query.creatorId || query.creatorIds),
        type: query.type,
        platform: query.platform,
        creatorIds: creatorIds.length,
        userInteractionCount: Object.keys(userInteractions).length,
      });

      return { items: enrichedItems, pageInfo };
    } catch (error: unknown) {
      this.logger.warn('외부 데이터 조회 실패, 기본 데이터 사용', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: items.length,
      });

      // 🔥 폴백 처리 (authz-server 패턴)
      const fallbackItems = this.buildFallbackContentSearchResults(items);
      return { items: fallbackItems, pageInfo };
    }
  }

  async getContentById(
    contentId: string,
    userId?: string,
  ): Promise<ContentDetailDto> {
    try {
      const content = await this.findByIdOrFail(contentId);

      const detailDto = plainToInstance(ContentDetailDto, content, {
        excludeExtraneousValues: true,
      });

      // UserInteractionService 연동하여 사용자별 상호작용 정보 추가
      if (userId) {
        try {
          detailDto.isBookmarked = await this.userInteractionService.isBookmarked(userId, contentId);
          detailDto.isLiked = await this.userInteractionService.isLiked(userId, contentId);
          const interaction = await this.userInteractionService.getInteractionDetail(userId, contentId);
          if (interaction) {
            if (interaction.watchedAt) detailDto.watchedAt = interaction.watchedAt;
            if (interaction.watchDuration) detailDto.watchDuration = interaction.watchDuration;
            if (interaction.rating) detailDto.rating = interaction.rating;
          }
        } catch (error: unknown) {
          this.logger.warn('Failed to fetch user interactions for content detail', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            contentId,
          });
          // 사용자 상호작용 정보 조회 실패 시 기본값 유지
        }
      }

      this.logger.debug('Content detail fetched', {
        contentId,
        userId,
        type: content.type,
        platform: content.platform,
      });

      return detailDto;
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
    hours: number = 24,
    limit: number = 50,
  ): Promise<ContentSearchResultDto[]> {
    try {
      const contents = await this.contentRepo.getTrendingContent(hours, limit);

      const trendingResults = contents.map((content) =>
        plainToInstance(ContentSearchResultDto, content, {
          excludeExtraneousValues: true,
        }),
      );

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
      const contents = await this.contentRepo.getRecentContent(creatorIds, limit);

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

  // ==================== 변경 메서드 ====================

  async createContent(
    dto: CreateContentDto,
    transactionManager?: EntityManager,
  ): Promise<void> {
    // 1. 사전 검증 (중복 확인)
    const existing = await this.contentRepo.findOne({
      where: { platformId: dto.platformId, platform: dto.platform as PlatformType }
    });
    if (existing) {
      this.logger.warn('Content creation failed: duplicate platform content', {
        platformId: dto.platformId,
        platform: dto.platform,
      });
      throw ContentException.contentAlreadyExists();
    }

    // 2. 엔티티 생성
    const content = new ContentEntity();
    Object.assign(content, {
      type: dto.type,
      title: dto.title,
      description: dto.description,
      thumbnail: dto.thumbnail,
      url: dto.url,
      platform: dto.platform,
      platformId: dto.platformId,
      duration: dto.duration,
      publishedAt: new Date(dto.publishedAt),
      creatorId: dto.creatorId,
      language: dto.language,
      isLive: dto.isLive || false,
      quality: dto.quality,
      ageRestriction: dto.ageRestriction || false,
    });

    // 통계 정보 생성
    const statistics = new ContentStatisticsEntity();
    statistics.contentId = content.id;
    statistics.views = dto.initialViews || 0;
    statistics.likes = dto.initialLikes || 0;
    statistics.comments = dto.initialComments || 0;
    statistics.shares = dto.initialShares || 0;

    // 3. 저장
    const repository = transactionManager
      ? transactionManager.getRepository(ContentEntity)
      : this.contentRepo;
    
    const statisticsRepository = transactionManager
      ? transactionManager.getRepository(ContentStatisticsEntity)
      : this.dataSource.getRepository(ContentStatisticsEntity);

    const savedContent = transactionManager
      ? await repository.save(content)
      : await this.contentRepo.saveEntity(content);

    // 4. 통계 저장
    statistics.contentId = savedContent.id;
    await statisticsRepository.save(statistics);

    // 5. 성공 로깅
    this.logger.log('Content created successfully', {
      contentId: savedContent.id,
      type: dto.type,
      platform: dto.platform,
      platformId: dto.platformId,
      creatorId: dto.creatorId,
    });
  }

  async updateContent(
    contentId: string,
    dto: UpdateContentDto,
    transactionManager?: EntityManager,
  ): Promise<void> {
    const content = await this.findByIdOrFail(contentId);

    // 업데이트할 필드만 변경
    Object.assign(content, dto);

    const repository = transactionManager
      ? transactionManager.getRepository(ContentEntity)
      : this.contentRepo;

    transactionManager
      ? await repository.save(content)
      : await this.contentRepo.saveEntity(content);

    this.logger.log('Content updated successfully', {
      contentId,
      updatedFields: Object.keys(dto),
    });
  }

  async updateContentStatistics(
    contentId: string,
    dto: UpdateContentStatisticsDto,
  ): Promise<void> {
    // 1. 콘텐츠 존재 확인
    await this.findByIdOrFail(contentId);

    // 2. 통계 엔티티 조회 또는 생성
    const statisticsRepo = this.dataSource.getRepository(ContentStatisticsEntity);
    let statistics = await statisticsRepo.findOne({ where: { contentId } });

    if (statistics) {
      Object.assign(statistics, dto);
    } else {
      // 통계가 없는 경우 새로 생성
      statistics = new ContentStatisticsEntity();
      statistics.contentId = contentId;
      Object.assign(statistics, dto);
    }

    // 3. 통계 저장
    await statisticsRepo.save(statistics);

    this.logger.log('Content statistics updated successfully', {
      contentId,
      updatedFields: Object.keys(dto),
    });
  }

  async deleteContent(contentId: string): Promise<UpdateResult> {
    await this.findByIdOrFail(contentId);

    await this.contentRepo.delete(contentId);

    this.logger.log('Content deleted successfully', { contentId });

    return { affected: 1 } as UpdateResult;
  }

  // ==================== 통계 메서드 ====================

  async getContentCountByCreatorId(creatorId: string): Promise<number> {
    return this.contentRepo.count({
      where: { creatorId },
    });
  }

  async getTotalViewsByCreatorId(creatorId: string): Promise<number> {
    try {
      const result = await this.dataSource
        .getRepository(ContentStatisticsEntity)
        .createQueryBuilder('stats')
        .leftJoin('content', 'content', 'content.id = stats.contentId')
        .select('SUM(stats.views)', 'totalViews')
        .where('content.creatorId = :creatorId', { creatorId })
        .getRawOne();

      return Number(result?.totalViews) || 0;
    } catch (error: unknown) {
      this.logger.error('Failed to get total views by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  // ==================== YouTube API 정책 준수 메서드 ====================
  // Rolling Window: 비동의 크리에이터의 30일 데이터 보존 정책

  async cleanupOldContent(daysOld: number = 30): Promise<{ 
    deletedCount: number; 
  }> {
    try {
      this.logger.log('Starting old content cleanup');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      // 오래된 콘텐츠 조회
      const oldContents = await this.contentRepo.find({
        where: {
          createdAt: LessThan(cutoffDate)
        },
        select: ['id', 'title', 'platform', 'platformId', 'createdAt']
      });

      if (oldContents.length === 0) {
        this.logger.debug('No old content found for cleanup');
        return { 
          deletedCount: 0 
        };
      }

      let deletedCount = 0;

      // 오래된 콘텐츠 배치 삭제
      if (oldContents.length > 0) {
        const contentIds = oldContents.map(content => content.id);
        const deleteResult = await this.contentRepo.delete(contentIds);
        deletedCount = deleteResult.affected || 0;
      }

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

  async refreshContentMetadata(contentId: string): Promise<void> {
    try {
      const content = await this.findByIdOrFail(contentId);
      
      // 메타데이터 갱신 시간 업데이트
      await this.contentRepo.update(contentId, {
        updatedAt: new Date()
      });

      this.logger.debug('Content metadata refreshed', {
        contentId,
        platform: content.platform,
        platformId: content.platformId,
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

  async updateContentBatch(contentIds: string[], updateData: Partial<ContentEntity>): Promise<void> {
    try {
      if (contentIds.length === 0) return;

      await this.contentRepo.batchUpdateContent(contentIds, updateData);

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

  async revokeCreatorDataConsent(creatorId: string): Promise<{ deletedCount: number }> {
    try {
      this.logger.log('Revoking data consent for creator', { creatorId });

      // 해당 크리에이터의 모든 콘텐츠 삭제 (동의 철회 시)
      const deleteResult = await this.contentRepo.delete({ creatorId });
      const deletedCount = deleteResult.affected || 0;

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
      
      // 오래된 데이터 조회
      const oldContents = await this.contentRepo.find({
        where: {
          creatorId,
          publishedAt: LessThan(cutoffDate)
        },
        select: ['id', 'title', 'platform', 'platformId', 'publishedAt']
      });
      
      // 최신 데이터 조회 (보존할 데이터)
      const recentContents = await this.contentRepo.find({
        where: {
          creatorId,
          publishedAt: MoreThan(cutoffDate)
        },
        order: { publishedAt: 'ASC' },
        select: ['id', 'publishedAt']
      });
      
      let deletedCount = 0;
      
      // 오래된 데이터 대량 삭제
      if (oldContents.length > 0) {
        const contentIds = oldContents.map(content => content.id);
        const deleteResult = await this.contentRepo.delete(contentIds);
        deletedCount = deleteResult.affected || 0;
      }
      
      const oldestRetainedDate = recentContents.length > 0 
        ? (recentContents[0]?.publishedAt || null)
        : null;
      
      this.logger.log('Old content cleanup completed for creator', {
        creatorId,
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate,
        cutoffDate,
        daysOld,
        platformBreakdown: oldContents.reduce((acc, content) => {
          acc[content.platform] = (acc[content.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
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
  
  /**
   * 특정 크리에이터의 비동의 데이터 전체 삭제
   * (동의 철회 시 사용)
   */
  async deleteAllNonConsentedData(creatorId: string): Promise<{ deletedCount: number }> {
    try {
      this.logger.log('Deleting all non-consented data for creator', { creatorId });
      
      // 비인증 데이터만 삭제 (인증 데이터는 보존)
      const deleteResult = await this.contentRepo.delete({
        creatorId,
        isAuthorizedData: false
      });
      
      const deletedCount = deleteResult.affected || 0;
      
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
  
  /**
   * 크리에이터의 콘텐츠 통계
   */
  async getCreatorContentStats(creatorId: string): Promise<{
    total: number;
    within30Days: number;
    older30Days: number;
    platformBreakdown: Record<string, number>;
    typeBreakdown: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const contents = await this.contentRepo.find({
        where: { creatorId },
        select: ['id', 'platform', 'type', 'publishedAt']
      });
      
      const stats = {
        total: contents.length,
        within30Days: contents.filter(c => c.publishedAt > thirtyDaysAgo).length,
        older30Days: contents.filter(c => c.publishedAt <= thirtyDaysAgo).length,
        platformBreakdown: {} as Record<string, number>,
        typeBreakdown: {} as Record<string, number>
      };
      
      // 플랫폼별 통계
      contents.forEach(content => {
        if (content.platform) {
          stats.platformBreakdown[content.platform] = (stats.platformBreakdown[content.platform] || 0) + 1;
        }
        if (content.type) {
          stats.typeBreakdown[content.type] = (stats.typeBreakdown[content.type] || 0) + 1;
        }
      });
      
      this.logger.debug('Creator content stats calculated', {
        creatorId,
        ...stats
      });
      
      return stats;
    } catch (error: unknown) {
      this.logger.error('Failed to get creator content stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentAgeStats(): Promise<{
    totalOld: number; // 30일 이상된 콘텐츠
    totalRecent: number; // 30일 이내 콘텐츠
    platformBreakdown: Record<string, { old: number; recent: number }>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const [oldContents, recentContents] = await Promise.all([
        this.contentRepo.find({
          where: { publishedAt: LessThan(thirtyDaysAgo) },
          select: ['id', 'platform']
        }),
        this.contentRepo.find({
          where: { publishedAt: MoreThan(thirtyDaysAgo) },
          select: ['id', 'platform']
        })
      ]);

      const platformBreakdown: Record<string, { old: number; recent: number }> = {};

      oldContents.forEach(content => {
        if (!platformBreakdown[content.platform]) {
          platformBreakdown[content.platform] = { old: 0, recent: 0 };
        }
        platformBreakdown[content.platform].old++;
      });

      recentContents.forEach(content => {
        if (!platformBreakdown[content.platform]) {
          platformBreakdown[content.platform] = { old: 0, recent: 0 };
        }
        platformBreakdown[content.platform].recent++;
      });

      return {
        totalOld: oldContents.length,
        totalRecent: recentContents.length,
        platformBreakdown
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get content age stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 크리에이터의 오래된 콘텐츠 상태 검사
   * 지정된 기간 이상 된 데이터가 있는지 확인
   */
  async checkOldContentStatus(creatorId: string, daysOld: number = 30): Promise<{
    needsCleanup: boolean;
    oldDataCount: number;
    oldestDataDate: Date | null;
    recentDataCount: number;
  }> {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
      
      const [oldData, recentData] = await Promise.all([
        this.contentRepo.find({
          where: {
            creatorId,
            publishedAt: LessThan(cutoffDate)
          },
          order: { publishedAt: 'ASC' },
          select: ['id', 'publishedAt']
        }),
        this.contentRepo.find({
          where: {
            creatorId,
            publishedAt: MoreThan(cutoffDate)
          },
          select: ['id']
        })
      ]);
      
      const needsCleanup = oldData.length > 0;
      const oldestDataDate = oldData.length > 0 ? (oldData[0]?.publishedAt || null) : null;
      
      this.logger.debug('Old content status checked', {
        creatorId,
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length,
        cutoffDate,
        daysOld
      });
      
      return {
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length
      };
    } catch (error: unknown) {
      this.logger.error('Failed to check rolling window status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
      });
      throw ContentException.contentFetchError();
    }
  }
  
  /**
   * 지연 함수 (API 레이트 리미팅용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 분리된 엔티티 데이터 배치 조회 ====================

  private async getContentCategoriesByContentIds(contentIds: string[]): Promise<Record<string, ContentCategoryDto[]>> {
    if (contentIds.length === 0) return {};

    try {
      const categories = await this.contentCategoryService.findByContentIds(contentIds);
      
      // contentId별로 그룹화
      const groupedCategories: Record<string, ContentCategoryDto[]> = {};
      categories.forEach(category => {
        if (!groupedCategories[category.contentId]) {
          groupedCategories[category.contentId] = [];
        }
        groupedCategories[category.contentId].push({
          category: category.category,
          isPrimary: category.isPrimary,
          subcategory: category.subcategory,
          confidence: category.confidence,
          source: category.source,
          classifiedBy: category.classifiedBy,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        });
      });

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
      const tags = await this.contentTagService.findByContentIds(contentIds);
      
      // contentId별로 그룹화
      const groupedTags: Record<string, ContentTagDto[]> = {};
      tags.forEach(tag => {
        if (!groupedTags[tag.contentId]) {
          groupedTags[tag.contentId] = [];
        }
        groupedTags[tag.contentId].push({
          tag: tag.tag,
          source: tag.source,
          relevanceScore: tag.relevanceScore,
          addedBy: tag.addedBy,
          usageCount: tag.usageCount,
          createdAt: tag.createdAt,
        });
      });

      return groupedTags;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch content tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================


  // 콘텐츠 통계 정보 조회 (ContentStatistics 연동)
  private async getContentStatisticsByIds(
    contentIds: string[]
  ): Promise<Record<string, { views: number; likes: number; comments: number; shares: number; engagementRate: number; updatedAt: Date; }>> {
    try {
      if (contentIds.length === 0) return {};

      const statisticsRepo = this.dataSource.getRepository(ContentStatisticsEntity);
      const statistics = await statisticsRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<string, { views: number; likes: number; comments: number; shares: number; engagementRate: number; updatedAt: Date; }> = {};
      
      statistics.forEach((stat) => {
        result[stat.contentId] = {
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

  // 🔥 콘텐츠 검색 결과 빌드 (데이터 정규화 기반)
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

      return {
        id: content.id!,
        type: content.type!,
        title: content.title!,
        description: content.description,
        thumbnail: content.thumbnail!,
        url: content.url!,
        platform: content.platform!,
        platformId: content.platformId!,
        duration: content.duration,
        publishedAt: content.publishedAt!,
        creatorId: content.creatorId!,
        language: content.language,
        isLive: content.isLive || false,
        quality: content.quality,
        ageRestriction: content.ageRestriction || false,
        // 🔥 분리된 엔티티 데이터 포함
        categories: contentCategories[content.id!] || [],
        tags: contentTags[content.id!] || [],
        createdAt: content.createdAt!,
        statistics, // 실제 통계 사용
        // 🔥 크리에이터 정보는 별도 API 호출로 조회 (데이터 정규화)
        // 🔥 사용자 상호작용 정보 (userId가 있을 때만)
        isBookmarked: userId ? (interaction?.isBookmarked || false) : undefined,
        isLiked: userId ? (interaction?.isLiked || false) : undefined,
        watchedAt: userId ? (interaction as { watchedAt?: Date })?.watchedAt : undefined,
        rating: userId ? interaction?.rating : undefined,
      };
    });
  }

  // 🔥 폴백 처리 결과 빌드 (authz-server 패턴)
  private buildFallbackContentSearchResults(contents: Partial<ContentEntity>[]): ContentSearchResultDto[] {
    return contents.map((content) => ({
      id: content.id!,
      type: content.type!,
      title: content.title!,
      description: content.description,
      thumbnail: content.thumbnail!,
      url: content.url!,
      platform: content.platform!,
      platformId: content.platformId!,
      duration: content.duration,
      publishedAt: content.publishedAt!,
      creatorId: content.creatorId!,
      // 개별 메타데이터 필드 (JSON 제거)
      language: content.language,
      isLive: content.isLive || false,
      quality: content.quality,
      ageRestriction: content.ageRestriction || false,
      // 🔥 분리된 엔티티 데이터 (폴백 시 빈 배열)
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
      // 🔥 크리에이터 정보는 별도 API 호출로 조회 (폴백)
      // 🔥 사용자 상호작용 정보 기본값
      isBookmarked: undefined,
      isLiked: undefined,
      watchedAt: undefined,
      rating: undefined,
    }));
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.contentRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.error('Failed to get total content count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== 콘텐츠 관리 메서드 ====================

  async updateContentDetails(
    contentId: string,
    updateData: Partial<Pick<ContentEntity, 'title' | 'description' | 'thumbnail' | 'language' | 'isLive' | 'quality' | 'ageRestriction'>>,
    transactionManager?: EntityManager,
  ): Promise<void> {
    try {
      // 1. 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // 2. 콘텐츠 정보 업데이트
      const finalUpdateData: Partial<ContentEntity> = {
        ...updateData,
        updatedAt: new Date(),
      };

      const repo = transactionManager ? transactionManager.getRepository(ContentEntity) : this.contentRepo;
      await repo.update(contentId, finalUpdateData);

      this.logger.log('Content details updated successfully', {
        contentId,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content details update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async getRecentContent(
    limit?: number,
    platform?: string
  ): Promise<ContentEntity[]> {
    try {
      const queryOptions: any = {
        order: { publishedAt: 'DESC' },
      };

      if (platform) {
        queryOptions.where = { platform };
      }

      if (limit) {
        queryOptions.take = limit;
      }

      return await this.contentRepo.find(queryOptions);
    } catch (error: unknown) {
      this.logger.error('Failed to get recent content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentStatistics(): Promise<{
    totalContent: number;
    contentByPlatform: Array<{ platform: string; count: number }>;
    contentByType: Array<{ type: string; count: number }>;
    liveContent: number;
    ageRestrictedContent: number;
  }> {
    try {
      const [
        totalContent,
        liveContent,
        ageRestrictedContent,
        contentByPlatform,
        contentByType,
      ] = await Promise.all([
        this.contentRepo.count(),
        this.contentRepo.count({ where: { isLive: true } }),
        this.contentRepo.count({ where: { ageRestriction: true } }),
        this.contentRepo.getPlatformDistribution(),
        this.contentRepo.createQueryBuilder('content')
          .select('content.type', 'type')
          .addSelect('COUNT(*)', 'count')
          .groupBy('content.type')
          .getRawMany(),
      ]);

      this.logger.debug('Content statistics calculated', {
        totalContent,
        liveContent,
        ageRestrictedContent,
        platformCount: contentByPlatform.length,
        typeCount: contentByType.length,
      });

      return {
        totalContent,
        contentByPlatform,
        contentByType: contentByType.map(item => ({
          type: item.type,
          count: parseInt(item.count),
        })),
        liveContent,
        ageRestrictedContent,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get content statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentReports(contentId: string): Promise<Array<{
    id: string;
    reportedBy: string;
    reason: string;
    status: string;
    reportedAt: Date;
    reviewedAt?: Date;
    reviewComment?: string;
  }>> {
    try {
      // 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // ReportService는 circular dependency를 피하기 위해 직접 주입하지 않음
      // AdminContentController에서 직접 ReportService를 사용하도록 구조 변경
      
      this.logger.debug('Content reports request', { contentId });
      return [];
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to get content reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentReportCount(contentId: string): Promise<number> {
    try {
      // 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // TODO: ReportService 연동 후 실제 신고 수 반환
      // 현재는 0 반환
      return 0;
    } catch (error: unknown) {
      this.logger.error('Failed to get content report count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return 0;
    }
  }

  // ==================== ADMIN 시간대별 통계 메서드 ====================

  async getContentCountByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.contentRepo.count({ where: { creatorId } });
    } catch (error: unknown) {
      this.logger.error('Failed to get content count by creator ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getTotalViewsByCreatorId(creatorId: string): Promise<number> {
    try {
      const result = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('content_statistics', 'stats', 'content.id = stats.contentId')
        .select('SUM(stats.views)', 'totalViews')
        .where('content.creatorId = :creatorId', { creatorId })
        .getRawOne();

      return parseInt(result.totalViews) || 0;
    } catch (error: unknown) {
      this.logger.error('Failed to get total views by creator ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getNewContentCounts(days: number): Promise<{
    dailyNewContent: number;
    weeklyNewContent: number;
    monthlyNewContent: number;
  }> {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000));
      const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      const monthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const [dailyNewContent, weeklyNewContent, monthlyNewContent] = await Promise.all([
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(dayAgo),
          },
        }),
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(weekAgo),
          },
        }),
        this.contentRepo.count({
          where: {
            createdAt: MoreThan(monthAgo),
          },
        }),
      ]);

      return {
        dailyNewContent,
        weeklyNewContent,
        monthlyNewContent,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get new content counts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      return {
        dailyNewContent: 0,
        weeklyNewContent: 0,
        monthlyNewContent: 0,
      };
    }
  }

  async getTopContentByViews(limit: number = 10): Promise<Array<{
    contentId: string;
    title: string;
    views: number;
    creatorName: string;
  }>> {
    try {
      const results = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('content_statistics', 'stats', 'content.id = stats.contentId')
        .leftJoin('creators', 'creator', 'content.creatorId = creator.id')
        .select([
          'content.id as contentId',
          'content.title as title',
          'stats.views as views',
          'COALESCE(creator.displayName, creator.name) as creatorName',
        ])
        .orderBy('stats.views', 'DESC')
        .limit(limit)
        .getRawMany();

      return results.map(result => ({
        contentId: result.contentId,
        title: result.title,
        views: parseInt(result.views) || 0,
        creatorName: result.creatorName || `Creator ${result.contentId}`,
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get top content by views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  async getPlatformDistribution(): Promise<Array<{
    platform: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      const totalContent = await this.contentRepo.count();
      
      if (totalContent === 0) {
        return [];
      }

      const results = await this.contentRepo
        .createQueryBuilder('content')
        .select('content.platform', 'platform')
        .addSelect('COUNT(*)', 'contentCount')
        .groupBy('content.platform')
        .getRawMany();

      return results.map(result => ({
        platform: result.platform,
        contentCount: parseInt(result.contentCount),
        percentage: Math.round((parseInt(result.contentCount) / totalContent) * 100),
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get platform distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async getCategoryDistribution(): Promise<Array<{
    category: string;
    contentCount: number;
    percentage: number;
  }>> {
    try {
      const totalContent = await this.contentRepo.count();
      
      if (totalContent === 0) {
        return [];
      }

      // ContentCategory 엔티티를 통해 카테고리 분포 조회
      const results = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('content_categories', 'cc', 'content.id = cc.contentId')
        .leftJoin('categories', 'cat', 'cc.categoryId = cat.id')
        .select('cat.name', 'category')
        .addSelect('COUNT(*)', 'contentCount')
        .where('cat.name IS NOT NULL')
        .groupBy('cat.name')
        .getRawMany();

      return results.map(result => ({
        category: result.category,
        contentCount: parseInt(result.contentCount),
        percentage: Math.round((parseInt(result.contentCount) / totalContent) * 100),
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}