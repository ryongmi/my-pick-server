import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import {
  EntityManager,
  UpdateResult,
  In,
  FindOptionsWhere,
  LessThan,
  MoreThan,
  And,
  DataSource,
} from 'typeorm';
import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { PlatformType } from '@common/enums/index.js';
import { UserInteractionService } from '@modules/user-interaction/index.js';

import { ContentRepository } from '../repositories/index.js';
import { ContentModerationService } from './content-moderation.service.js';
import { ContentMetadataService } from './content-metadata.service.js';
import { ContentStatisticsService } from './content-statistics.service.js';
import { ContentSyncService } from './content-sync.service.js';
import { ContentEntity, ContentStatisticsEntity, ContentModerationEntity, ContentMetadataEntity } from '../entities/index.js';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  ContentDetailDto,
  CreateContentDto,
  UpdateContentDto,
  UpdateContentStatisticsDto,
} from '../dto/index.js';
import { ContentException } from '../exceptions/index.js';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly dataSource: DataSource,
    private readonly userInteractionService: UserInteractionService,
    private readonly contentModerationService: ContentModerationService,
    private readonly contentMetadataService: ContentMetadataService,
    private readonly contentStatisticsService: ContentStatisticsService,
    private readonly contentSyncService: ContentSyncService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
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
    userId?: string
  ): Promise<PaginatedResult<ContentSearchResultDto>> {
    // Create clean search options with proper types
    const cleanedOptions: Record<string, unknown> = {};

    // Copy defined properties from query
    Object.keys(query).forEach((key) => {
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

    const { items, pageInfo } = await this.contentRepo.searchContent(
      cleanedOptions as Parameters<typeof this.contentRepo.searchContent>[0]
    );

    if (items.length === 0) {
      return { items: [], pageInfo };
    }

    const contentIds = items.map((content) => content.id!);
    const creatorIds = [...new Set(items.map((content) => content.creatorId!))]; // 중복 제거

    try {
      // 🔥 콘텐츠 통계 정보 조회
      const contentStatistics = await this.getContentStatisticsByIds(contentIds);

      // 🔥 사용자 상호작용 정보 조회 (크리에이터 정보는 실시간 집계로 대체)
      const userInteractions = userId
        ? await this.getUserInteractionsByContentIds(userId, contentIds)
        : ({} as Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number }>);

      const enrichedItems = this.buildContentSearchResults(
        items,
        userInteractions,
        contentStatistics,
        userId
      );

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

  async getContentById(contentId: string, userId?: string): Promise<ContentDetailDto> {
    try {
      const content = await this.findByIdOrFail(contentId);

      const detailDto = plainToInstance(ContentDetailDto, content, {
        excludeExtraneousValues: true,
      });

      // UserInteractionService 연동하여 사용자별 상호작용 정보 추가
      if (userId) {
        try {
          detailDto.isBookmarked = await this.userInteractionService.isBookmarked(
            userId,
            contentId
          );
          detailDto.isLiked = await this.userInteractionService.isLiked(userId, contentId);
          const interaction = await this.userInteractionService.getInteractionDetail(
            userId,
            contentId
          );
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
    limit: number = 50
  ): Promise<ContentSearchResultDto[]> {
    try {
      const contents = await this.contentRepo.getTrendingContent(hours, limit);

      const trendingResults = contents.map((content) =>
        plainToInstance(ContentSearchResultDto, content, {
          excludeExtraneousValues: true,
        })
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
    limit: number = 20
  ): Promise<ContentSearchResultDto[]> {
    try {
      const contents = await this.contentRepo.getRecentContent(creatorIds, limit);

      const recentResults = contents.map((content) =>
        plainToInstance(ContentSearchResultDto, content, {
          excludeExtraneousValues: true,
        })
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

  async createContent(dto: CreateContentDto, transactionManager?: EntityManager): Promise<void> {
    // 1. 사전 검증 (중복 확인)
    const existing = await this.contentRepo.findOne({
      where: { platformId: dto.platformId, platform: dto.platform as PlatformType },
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
      metadata: dto.metadata,
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
    transactionManager?: EntityManager
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

  async updateContentStatistics(contentId: string, dto: UpdateContentStatisticsDto): Promise<void> {
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

  async cleanupExpiredContent(): Promise<{
    deletedCount: number;
    authorizedDataCount: number;
    nonAuthorizedDataCount: number;
  }> {
    try {
      this.logger.log('Starting expired content cleanup with authorization-based logic');

      const now = new Date();

      // 만료된 콘텐츠 조회 (비인증 데이터만 삭제 대상)
      const expiredContents = await this.contentRepo.find({
        where: {
          expiresAt: LessThan(now),
          isAuthorizedData: false, // 비인증 데이터만 삭제
        },
        select: ['id', 'title', 'platform', 'platformId', 'expiresAt', 'isAuthorizedData'],
      });

      // 만료되었지만 인증 데이터인 콘텐츠 (삭제하지 않음)
      const authorizedExpiredContents = await this.contentRepo.find({
        where: {
          expiresAt: LessThan(now),
          isAuthorizedData: true, // 인증 데이터는 보존
        },
        select: ['id', 'title', 'platform', 'platformId', 'expiresAt', 'isAuthorizedData'],
      });

      if (expiredContents.length === 0 && authorizedExpiredContents.length === 0) {
        this.logger.debug('No expired content found');
        return {
          deletedCount: 0,
          authorizedDataCount: 0,
          nonAuthorizedDataCount: 0,
        };
      }

      let deletedCount = 0;

      // 비인증 데이터만 배치 삭제
      if (expiredContents.length > 0) {
        const contentIds = expiredContents.map((content) => content.id);
        const deleteResult = await this.contentRepo.delete(contentIds);
        deletedCount = deleteResult.affected || 0;
      }

      this.logger.log('Expired content cleanup completed with authorization-based logic', {
        deletedCount,
        totalExpiredNonAuthorized: expiredContents.length,
        totalExpiredAuthorized: authorizedExpiredContents.length,
        nonAuthorizedPlatforms: expiredContents.reduce(
          (acc, content) => {
            acc[content.platform] = (acc[content.platform] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        authorizedPlatforms: authorizedExpiredContents.reduce(
          (acc, content) => {
            acc[content.platform] = (acc[content.platform] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      });

      // 인증 데이터의 경우 만료 시간 연장 (YouTube API 정책: 30일마다 재확인)
      if (authorizedExpiredContents.length > 0) {
        await this.extendAuthorizedDataExpiration(authorizedExpiredContents.map((c) => c.id));
      }

      return {
        deletedCount,
        authorizedDataCount: authorizedExpiredContents.length,
        nonAuthorizedDataCount: expiredContents.length,
      };
    } catch (error: unknown) {
      this.logger.error('Expired content cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentCleanupError();
    }
  }

  async refreshContentData(contentId: string): Promise<void> {
    try {
      const content = await this.findByIdOrFail(contentId);

      // 현재 시점으로 동기화 시간 업데이트
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일 후

      await this.contentRepo.update(contentId, {
        lastSyncedAt: now,
        expiresAt,
      });

      this.logger.debug('Content data refreshed', {
        contentId,
        platform: content.platform,
        platformId: content.platformId,
        lastSyncedAt: now,
        expiresAt,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content data refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async extendAuthorizedDataExpiration(contentIds: string[]): Promise<void> {
    try {
      if (contentIds.length === 0) return;

      // 인증 데이터의 만료 시간을 30일 연장 (YouTube API 정책: 30일마다 재확인)
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일 후

      await this.contentRepo.update(contentIds, {
        expiresAt: newExpiresAt,
        lastSyncedAt: now,
      });

      this.logger.log('Extended expiration for authorized content data', {
        contentCount: contentIds.length,
        newExpiresAt,
        lastSyncedAt: now,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to extend authorized data expiration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentIds: contentIds.slice(0, 5), // 처음 5개만 로깅
        contentCount: contentIds.length,
      });
      // 에러가 발생해도 전체 프로세스를 중단하지 않음
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
        deletedCount,
      });

      return { deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to revoke creator data consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  /**
   * Rolling Window: 비동의 크리에이터의 오래된 데이터 정리
   * 30일 이상 된 데이터를 삭제하고 최신 30일만 유지
   */
  async cleanupNonConsentedCreatorData(creatorId: string): Promise<{
    deletedCount: number;
    retainedCount: number;
    oldestRetainedDate: Date | null;
  }> {
    try {
      this.logger.log('Starting rolling window cleanup for non-consented creator', { creatorId });

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 30일 이상 된 비인증 데이터 조회
      const oldContents = await this.contentRepo.find({
        where: {
          creatorId,
          isAuthorizedData: false,
          publishedAt: LessThan(thirtyDaysAgo),
        },
        select: ['id', 'title', 'platform', 'platformId', 'publishedAt'],
      });

      // 최신 30일 데이터 조회 (보존할 데이터)
      const recentContents = await this.contentRepo.find({
        where: {
          creatorId,
          isAuthorizedData: false,
          publishedAt: MoreThan(thirtyDaysAgo),
        },
        order: { publishedAt: 'ASC' },
        select: ['id', 'publishedAt'],
      });

      let deletedCount = 0;

      // 오래된 데이터 대량 삭제
      if (oldContents.length > 0) {
        const contentIds = oldContents.map((content) => content.id);
        const deleteResult = await this.contentRepo.delete(contentIds);
        deletedCount = deleteResult.affected || 0;
      }

      const oldestRetainedDate =
        recentContents.length > 0 ? recentContents[0]?.publishedAt || null : null;

      this.logger.log('Rolling window cleanup completed for non-consented creator', {
        creatorId,
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate,
        cutoffDate: thirtyDaysAgo,
        platformBreakdown: oldContents.reduce(
          (acc, content) => {
            acc[content.platform] = (acc[content.platform] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      });

      return {
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate,
      };
    } catch (error: unknown) {
      this.logger.error('Rolling window cleanup failed for non-consented creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentCleanupError();
    }
  }

  /**
   * 비동의 크리에이터들의 Rolling Window 일괄 정리
   */
  async batchCleanupNonConsentedData(): Promise<{
    processedCreators: number;
    totalDeleted: number;
    totalRetained: number;
    errors: number;
  }> {
    try {
      this.logger.log('Starting batch rolling window cleanup for non-consented creators');

      // 비동의 크리에이터들의 콘텐츠 조회
      const nonConsentedContents = await this.contentRepo
        .createQueryBuilder('content')
        .leftJoin('creators', 'creator', 'creator.id = content.creatorId')
        .where('creator.hasDataConsent = :hasConsent', { hasConsent: false })
        .andWhere('content.isAuthorizedData = :isAuthorized', { isAuthorized: false })
        .select(['content.creatorId'])
        .distinct(true)
        .getRawMany();

      const creatorIds = nonConsentedContents.map((item) => item.content_creatorId);

      if (creatorIds.length === 0) {
        this.logger.debug('No non-consented creators found for rolling window cleanup');
        return {
          processedCreators: 0,
          totalDeleted: 0,
          totalRetained: 0,
          errors: 0,
        };
      }

      let totalDeleted = 0;
      let totalRetained = 0;
      let errors = 0;

      // 각 크리에이터별로 Rolling Window 적용
      for (const creatorId of creatorIds) {
        try {
          const result = await this.cleanupNonConsentedCreatorData(creatorId);
          totalDeleted += result.deletedCount;
          totalRetained += result.retainedCount;
        } catch (error: unknown) {
          errors++;
          this.logger.warn('Individual creator rolling window cleanup failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId,
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
        successRate: (((creatorIds.length - errors) / creatorIds.length) * 100).toFixed(1) + '%',
      });

      return {
        processedCreators: creatorIds.length,
        totalDeleted,
        totalRetained,
        errors,
      };
    } catch (error: unknown) {
      this.logger.error('Batch rolling window cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
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
        isAuthorizedData: false,
      });

      const deletedCount = deleteResult.affected || 0;

      this.logger.log('All non-consented data deleted for creator', {
        creatorId,
        deletedCount,
      });

      return { deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to delete all non-consented data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  /**
   * 크리에이터의 데이터 보존 상태 통계
   */
  async getCreatorDataRetentionStats(creatorId: string): Promise<{
    total: number;
    authorized: number;
    nonAuthorized: number;
    within30Days: number;
    older30Days: number;
    platformBreakdown: Record<string, { authorized: number; nonAuthorized: number }>;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const contents = await this.contentRepo.find({
        where: { creatorId },
        select: ['id', 'platform', 'isAuthorizedData', 'publishedAt'],
      });

      const stats = {
        total: contents.length,
        authorized: contents.filter((c) => c.isAuthorizedData).length,
        nonAuthorized: contents.filter((c) => !c.isAuthorizedData).length,
        within30Days: contents.filter((c) => c.publishedAt > thirtyDaysAgo).length,
        older30Days: contents.filter((c) => c.publishedAt <= thirtyDaysAgo).length,
        platformBreakdown: {} as Record<string, { authorized: number; nonAuthorized: number }>,
      };

      // 플랫폼별 통계
      contents.forEach((content) => {
        if (content.platform) {
          if (!stats.platformBreakdown[content.platform]) {
            stats.platformBreakdown[content.platform] = { authorized: 0, nonAuthorized: 0 };
          }

          const platformStats = stats.platformBreakdown[content.platform]!;
          if (content.isAuthorizedData) {
            platformStats.authorized++;
          } else {
            platformStats.nonAuthorized++;
          }
        }
      });

      this.logger.debug('Creator data retention stats calculated', {
        creatorId,
        ...stats,
      });

      return stats;
    } catch (error: unknown) {
      this.logger.error('Failed to get creator data retention stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getExpiredContentStats(): Promise<{
    totalExpired: number;
    expiringSoon: number; // 7일 이내 만료 예정
    platformBreakdown: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [expiredContents, expiringSoonContents] = await Promise.all([
        this.contentRepo.find({
          where: { expiresAt: LessThan(now) },
          select: ['id', 'platform'],
        }),
        this.contentRepo.find({
          where: {
            expiresAt: And(MoreThan(now), LessThan(sevenDaysFromNow)),
          },
          select: ['id', 'platform'],
        }),
      ]);

      const platformBreakdown = expiredContents.reduce(
        (acc, content) => {
          acc[content.platform] = (acc[content.platform] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalExpired: expiredContents.length,
        expiringSoon: expiringSoonContents.length,
        platformBreakdown,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get expired content stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 비동의 크리에이터의 Rolling Window 상태 검사
   * 30일 이상 된 데이터가 있는지 확인
   */
  async checkRollingWindowStatus(creatorId: string): Promise<{
    needsCleanup: boolean;
    oldDataCount: number;
    oldestDataDate: Date | null;
    recentDataCount: number;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [oldData, recentData] = await Promise.all([
        this.contentRepo.find({
          where: {
            creatorId,
            isAuthorizedData: false,
            publishedAt: LessThan(thirtyDaysAgo),
          },
          order: { publishedAt: 'ASC' },
          select: ['id', 'publishedAt'],
        }),
        this.contentRepo.find({
          where: {
            creatorId,
            isAuthorizedData: false,
            publishedAt: MoreThan(thirtyDaysAgo),
          },
          select: ['id'],
        }),
      ]);

      const needsCleanup = oldData.length > 0;
      const oldestDataDate = oldData.length > 0 ? oldData[0]?.publishedAt || null : null;

      this.logger.debug('Rolling window status checked', {
        creatorId,
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length,
        cutoffDate: thirtyDaysAgo,
      });

      return {
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to check rolling window status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 지연 함수 (API 레이트 리미팅용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== PRIVATE HELPER METHODS ====================

  // 콘텐츠 통계 정보 조회 (ContentStatistics 연동)
  private async getContentStatisticsByIds(
    contentIds: string[]
  ): Promise<
    Record<
      string,
      {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        engagementRate: number;
        updatedAt: Date;
      }
    >
  > {
    try {
      if (contentIds.length === 0) return {};

      const statisticsRepo = this.dataSource.getRepository(ContentStatisticsEntity);
      const statistics = await statisticsRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<
        string,
        {
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagementRate: number;
          updatedAt: Date;
        }
      > = {};

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
  ): Promise<
    Record<string, { isBookmarked?: boolean; isLiked?: boolean; rating?: number; watchedAt?: Date }>
  > {
    try {
      const interactions = await this.userInteractionService.getContentInteractionsBatch(
        contentIds,
        userId
      );

      const result: Record<
        string,
        { isBookmarked?: boolean; isLiked?: boolean; rating?: number; watchedAt?: Date }
      > = {};

      Object.entries(interactions).forEach(([contentId, interaction]) => {
        const interactionData: {
          isBookmarked?: boolean;
          isLiked?: boolean;
          rating?: number;
          watchedAt?: Date;
        } = {
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
    userInteractions: Record<
      string,
      { isBookmarked?: boolean; isLiked?: boolean; rating?: number }
    >,
    contentStatistics: Record<
      string,
      {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        engagementRate: number;
        updatedAt: Date;
      }
    >,
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
        updatedAt: new Date(),
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
        metadata: content.metadata!,
        createdAt: content.createdAt!,
        statistics, // 실제 통계 사용
        // 🔥 크리에이터 정보는 별도 API 호출로 조회 (데이터 정규화)
        // 🔥 사용자 상호작용 정보 (userId가 있을 때만)
        isBookmarked: userId ? interaction?.isBookmarked || false : undefined,
        isLiked: userId ? interaction?.isLiked || false : undefined,
        watchedAt: userId ? (interaction as { watchedAt?: Date })?.watchedAt : undefined,
        rating: userId ? interaction?.rating : undefined,
      };
    });
  }

  // 🔥 폴백 처리 결과 빌드 (authz-server 패턴)
  private buildFallbackContentSearchResults(
    contents: Partial<ContentEntity>[]
  ): ContentSearchResultDto[] {
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
      metadata: content.metadata!,
      createdAt: content.createdAt!,
      statistics: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        updatedAt: new Date(),
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

  // ==================== 상태 관리 메서드 ====================

  async updateContentStatus(
    contentId: string,
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    moderatedBy: string,
    reason?: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 콘텐츠 존재 확인
      await this.findByIdOrFail(contentId);

      // 2. 상태 업데이트
      const updateData: Partial<ContentEntity> = {
        status,
        moderatedBy,
        moderatedAt: new Date(),
      };

      if (reason) {
        updateData.statusReason = reason;
      }

      const repo = transactionManager
        ? transactionManager.getRepository(ContentEntity)
        : this.contentRepo;
      await repo.update(contentId, updateData);

      this.logger.log('Content status updated successfully', {
        contentId,
        status,
        moderatedBy,
        reason,
      });

      // 3. 상태별 추가 처리
      if (status === 'removed') {
        // TODO: 콘텐츠 제거 시 추가 처리 (알림, 캐시 무효화 등)
        this.logger.debug('Content marked as removed', { contentId });
      } else if (status === 'flagged') {
        // TODO: 플래그된 콘텐츠 처리 (관리자 알림 등)
        this.logger.debug('Content flagged for review', { contentId });
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        status,
        moderatedBy,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async getContentsByStatus(
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    limit?: number
  ): Promise<ContentEntity[]> {
    try {
      const queryOptions: any = {
        where: { status },
        order: { moderatedAt: 'DESC' },
      };

      if (limit) {
        queryOptions.take = limit;
      }

      return await this.contentRepo.find(queryOptions);
    } catch (error: unknown) {
      this.logger.error('Failed to get contents by status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentStatusStatistics(): Promise<{
    totalContent: number;
    activeContent: number;
    inactiveContent: number;
    flaggedContent: number;
    removedContent: number;
    contentByStatus: Array<{ status: string; count: number }>;
  }> {
    try {
      const [totalContent, activeContent, inactiveContent, flaggedContent, removedContent] =
        await Promise.all([
          this.contentRepo.count(),
          this.contentRepo.count({ where: { status: 'active' } }),
          this.contentRepo.count({ where: { status: 'inactive' } }),
          this.contentRepo.count({ where: { status: 'flagged' } }),
          this.contentRepo.count({ where: { status: 'removed' } }),
        ]);

      const contentByStatus = [
        { status: 'active', count: activeContent },
        { status: 'inactive', count: inactiveContent },
        { status: 'flagged', count: flaggedContent },
        { status: 'removed', count: removedContent },
      ];

      this.logger.debug('Content status statistics calculated', {
        totalContent,
        activeContent,
        inactiveContent,
        flaggedContent,
        removedContent,
      });

      return {
        totalContent,
        activeContent,
        inactiveContent,
        flaggedContent,
        removedContent,
        contentByStatus,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get content status statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getContentReports(contentId: string): Promise<
    Array<{
      id: string;
      reportedBy: string;
      reason: string;
      status: string;
      reportedAt: Date;
      reviewedAt?: Date;
      reviewComment?: string;
    }>
  > {
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

  // ==================== 분리된 엔티티 연동 메서드 ====================

  /**
   * 콘텐츠 상세 정보 조회 (모든 관련 데이터 포함)
   */
  async getContentDetail(contentId: string): Promise<{
    content: ContentEntity;
    metadata?: ContentMetadataEntity;
    moderation?: ContentModerationEntity;
    statistics?: ContentStatisticsEntity;
    sync?: any;
  }> {
    try {
      const content = await this.findByIdOrFail(contentId);

      const [metadata, moderation, statistics, sync] = await Promise.all([
        this.contentMetadataService.findByContentId(contentId),
        this.contentModerationService.findByContentId(contentId),
        this.contentStatisticsService.findByContentId(contentId),
        this.contentSyncService.findByContentId(contentId),
      ]);

      return {
        content,
        metadata: metadata || undefined,
        moderation: moderation || undefined,
        statistics: statistics || undefined,
        sync: sync || undefined,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to get content detail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 완전한 콘텐츠 생성 (모든 관련 엔티티 포함)
   */
  async createCompleteContent(
    contentData: CreateContentDto,
    options: {
      metadata: {
        tags: string[];
        category: string;
        language: string;
        isLive?: boolean;
        quality?: 'sd' | 'hd' | '4k';
        ageRestriction?: boolean;
      };
      initialStats?: {
        views?: number;
        likes?: number;
        comments?: number;
        shares?: number;
      };
      syncOptions?: {
        platform?: string;
        platformId?: string;
        isAuthorizedData?: boolean;
        expiresAt?: Date;
      };
      moderationStatus?: 'active' | 'inactive' | 'flagged' | 'removed';
    }
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      try {
        // 1. 메인 콘텐츠 생성
        const contentId = await this.createContent(contentData, manager);

        // 2. 메타데이터 생성
        await this.contentMetadataService.createMetadata(
          contentId,
          options.metadata,
          manager
        );

        // 3. 모더레이션 레코드 생성
        await this.contentModerationService.createModerationRecord(
          contentId,
          { moderationStatus: options.moderationStatus },
          manager
        );

        // 4. 통계 레코드 생성
        await this.contentStatisticsService.createStatistics(
          contentId,
          options.initialStats,
          manager
        );

        // 5. 동기화 레코드 생성 (옵션)
        if (options.syncOptions) {
          await this.contentSyncService.createSyncRecord(
            contentId,
            options.syncOptions,
            manager
          );
        }

        this.logger.log('Complete content created successfully', {
          contentId,
          hasMetadata: true,
          hasModeration: true,
          hasStatistics: true,
          hasSync: !!options.syncOptions,
        });

        return contentId;
      } catch (error: unknown) {
        this.logger.error('Complete content creation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          contentTitle: contentData.title,
        });
        throw ContentException.contentCreateError();
      }
    });
  }

  /**
   * 완전한 콘텐츠 삭제 (모든 관련 엔티티 포함)
   */
  async deleteCompleteContent(contentId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      try {
        // 콘텐츠 존재 확인
        await this.findByIdOrFail(contentId);

        // 관련 엔티티들 삭제 (병렬 처리)
        await Promise.all([
          this.contentMetadataService.deleteMetadata(contentId),
          this.contentModerationService.deleteModerationRecord(contentId),
          this.contentStatisticsService.deleteStatistics(contentId),
          this.contentSyncService.deleteSyncRecord(contentId),
        ]);

        // 메인 콘텐츠 삭제
        await this.deleteContent(contentId);

        this.logger.log('Complete content deleted successfully', {
          contentId,
        });
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
    });
  }

  /**
   * 배치로 콘텐츠 상세 정보 조회
   */
  async getContentDetailBatch(contentIds: string[]): Promise<Record<string, {
    content: ContentEntity;
    metadata?: ContentMetadataEntity;
    moderation?: ContentModerationEntity;
    statistics?: ContentStatisticsEntity;
  }>> {
    try {
      if (contentIds.length === 0) return {};

      const [contents, metadataBatch, moderationBatch, statisticsBatch] = await Promise.all([
        this.findByIds(contentIds),
        this.contentMetadataService.getMetadataBatch(contentIds),
        this.contentModerationService.getModerationBatch(contentIds),
        this.contentStatisticsService.getStatisticsBatch(contentIds),
      ]);

      const result: Record<string, any> = {};
      
      contents.forEach(content => {
        result[content.id] = {
          content,
          metadata: metadataBatch[content.id],
          moderation: moderationBatch[content.id],
          statistics: statisticsBatch[content.id],
        };
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch content detail batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  // ==================== 새로운 검색 메서드 (메타데이터 활용) ====================

  /**
   * 태그 기반 콘텐츠 검색
   */
  async searchByTags(
    tags: string[],
    searchMode: 'any' | 'all' = 'any',
    limit?: number
  ): Promise<ContentEntity[]> {
    try {
      const metadataList = await this.contentMetadataService.findByTags(tags, searchMode, limit);
      const contentIds = metadataList.map(m => m.contentId);
      
      if (contentIds.length === 0) return [];
      
      return this.findByIds(contentIds);
    } catch (error: unknown) {
      this.logger.error('Tag-based content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tags,
        searchMode,
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 카테고리별 콘텐츠 검색
   */
  async findByCategory(category: string, limit?: number): Promise<ContentEntity[]> {
    try {
      const metadataList = await this.contentMetadataService.findByCategory(category, limit);
      const contentIds = metadataList.map(m => m.contentId);
      
      if (contentIds.length === 0) return [];
      
      return this.findByIds(contentIds);
    } catch (error: unknown) {
      this.logger.error('Category-based content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 라이브 콘텐츠 조회
   */
  async findLiveContent(limit?: number): Promise<ContentEntity[]> {
    try {
      const metadataList = await this.contentMetadataService.findLiveContent(limit);
      const contentIds = metadataList.map(m => m.contentId);
      
      if (contentIds.length === 0) return [];
      
      return this.findByIds(contentIds);
    } catch (error: unknown) {
      this.logger.error('Live content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  /**
   * 모더레이션 상태별 콘텐츠 조회
   */
  async findByModerationStatus(
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    limit?: number
  ): Promise<ContentEntity[]> {
    try {
      const moderationRepo = this.dataSource.getRepository(ContentModerationEntity);
      const queryOptions: any = {
        where: { moderationStatus: status },
        order: { moderatedAt: 'DESC' },
      };

      if (limit) {
        queryOptions.take = limit;
      }

      const moderationList = await moderationRepo.find(queryOptions);
      const contentIds = moderationList.map(m => m.contentId);
      
      if (contentIds.length === 0) return [];
      
      return this.findByIds(contentIds);
    } catch (error: unknown) {
      this.logger.error('Moderation status based content search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status,
      });
      throw ContentException.contentFetchError();
    }
  }
}
