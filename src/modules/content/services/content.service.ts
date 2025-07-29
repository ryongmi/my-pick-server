import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { EntityManager, UpdateResult, In, FindOptionsWhere, LessThan, MoreThan, And } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';

import { ContentRepository } from '../repositories';
import { ContentEntity, ContentStatisticsEntity } from '../entities';
import {
  ContentSearchQueryDto,
  ContentSearchResultDto,
  ContentDetailDto,
  CreateContentDto,
  UpdateContentDto,
  UpdateContentStatisticsDto,
} from '../dto';
import { ContentException } from '../exceptions';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly contentRepo: ContentRepository,
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
      where: { platformId, platform },
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
    const searchOptions = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const { items, pageInfo } = await this.contentRepo.searchContent(searchOptions);
    
    if (items.length === 0) {
      return { items: [], pageInfo };
    }

    const contentIds = items.map((content) => content.id!);
    const creatorIds = [...new Set(items.map((content) => content.creatorId!))]; // 중복 제거

    try {
      // 🔥 사용자 상호작용 정보 조회 (크리에이터 정보는 실시간 집계로 대체)
      const userInteractions = userId ? await this.getUserInteractionsByContentIds(userId, contentIds) : {};

      const enrichedItems = this.buildContentSearchResults(items, userInteractions, userId);
      
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

      // TODO: UserInteractionService 연동하여 사용자별 상호작용 정보 추가
      if (userId) {
        // detailDto.isBookmarked = await this.userInteractionService.isBookmarked(userId, contentId);
        // detailDto.isLiked = await this.userInteractionService.isLiked(userId, contentId);
        // const interaction = await this.userInteractionService.getInteractionDetail(userId, contentId);
        // if (interaction) {
        //   detailDto.watchedAt = interaction.watchedAt;
        //   detailDto.watchDuration = interaction.watchDuration;
        //   detailDto.rating = interaction.rating;
        // }
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
      where: { platformId: dto.platformId, platform: dto.platform }
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

    content.statistics = statistics;

    // 3. 저장
    const repository = transactionManager
      ? transactionManager.getRepository(ContentEntity)
      : this.contentRepo;

    const savedContent = transactionManager
      ? await repository.save(content)
      : await this.contentRepo.saveEntity(content);

    // 4. 성공 로깅
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
    const content = await this.findByIdOrFail(contentId);

    if (content.statistics) {
      Object.assign(content.statistics, dto);
    } else {
      // 통계가 없는 경우 새로 생성
      const statistics = new ContentStatisticsEntity();
      statistics.contentId = contentId;
      Object.assign(statistics, dto);
      content.statistics = statistics;
    }

    await this.contentRepo.saveEntity(content);

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
          isAuthorizedData: false // 비인증 데이터만 삭제
        },
        select: ['id', 'title', 'platform', 'platformId', 'expiresAt', 'isAuthorizedData']
      });

      // 만료되었지만 인증 데이터인 콘텐츠 (삭제하지 않음)
      const authorizedExpiredContents = await this.contentRepo.find({
        where: {
          expiresAt: LessThan(now),
          isAuthorizedData: true // 인증 데이터는 보존
        },
        select: ['id', 'title', 'platform', 'platformId', 'expiresAt', 'isAuthorizedData']
      });

      if (expiredContents.length === 0 && authorizedExpiredContents.length === 0) {
        this.logger.debug('No expired content found');
        return { 
          deletedCount: 0, 
          authorizedDataCount: 0, 
          nonAuthorizedDataCount: 0 
        };
      }

      let deletedCount = 0;

      // 비인증 데이터만 배치 삭제
      if (expiredContents.length > 0) {
        const contentIds = expiredContents.map(content => content.id);
        const deleteResult = await this.contentRepo.delete(contentIds);
        deletedCount = deleteResult.affected || 0;
      }

      this.logger.log('Expired content cleanup completed with authorization-based logic', {
        deletedCount,
        totalExpiredNonAuthorized: expiredContents.length,
        totalExpiredAuthorized: authorizedExpiredContents.length,
        nonAuthorizedPlatforms: expiredContents.reduce((acc, content) => {
          acc[content.platform] = (acc[content.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        authorizedPlatforms: authorizedExpiredContents.reduce((acc, content) => {
          acc[content.platform] = (acc[content.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      // 인증 데이터의 경우 만료 시간 연장 (YouTube API 정책: 30일마다 재확인)
      if (authorizedExpiredContents.length > 0) {
        await this.extendAuthorizedDataExpiration(authorizedExpiredContents.map(c => c.id));
      }

      return { 
        deletedCount, 
        authorizedDataCount: authorizedExpiredContents.length,
        nonAuthorizedDataCount: expiredContents.length
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
      const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30일 후

      await this.contentRepo.update(contentId, {
        lastSyncedAt: now,
        expiresAt
      });

      this.logger.debug('Content data refreshed', {
        contentId,
        platform: content.platform,
        platformId: content.platformId,
        lastSyncedAt: now,
        expiresAt
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
      const newExpiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30일 후

      await this.contentRepo.update(contentIds, {
        expiresAt: newExpiresAt,
        lastSyncedAt: now
      });

      this.logger.log('Extended expiration for authorized content data', {
        contentCount: contentIds.length,
        newExpiresAt,
        lastSyncedAt: now
      });
    } catch (error: unknown) {
      this.logger.error('Failed to extend authorized data expiration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentIds: contentIds.slice(0, 5), // 처음 5개만 로깅
        contentCount: contentIds.length
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
  async cleanupNonConsentedCreatorData(creatorId: string): Promise<{
    deletedCount: number;
    retainedCount: number;
    oldestRetainedDate: Date | null;
  }> {
    try {
      this.logger.log('Starting rolling window cleanup for non-consented creator', { creatorId });
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      // 30일 이상 된 비인증 데이터 조회
      const oldContents = await this.contentRepo.find({
        where: {
          creatorId,
          isAuthorizedData: false,
          publishedAt: LessThan(thirtyDaysAgo)
        },
        select: ['id', 'title', 'platform', 'platformId', 'publishedAt']
      });
      
      // 최신 30일 데이터 조회 (보존할 데이터)
      const recentContents = await this.contentRepo.find({
        where: {
          creatorId,
          isAuthorizedData: false,
          publishedAt: MoreThan(thirtyDaysAgo)
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
        ? recentContents[0].publishedAt 
        : null;
      
      this.logger.log('Rolling window cleanup completed for non-consented creator', {
        creatorId,
        deletedCount,
        retainedCount: recentContents.length,
        oldestRetainedDate,
        cutoffDate: thirtyDaysAgo,
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
      this.logger.error('Rolling window cleanup failed for non-consented creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
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
      const nonConsentedContents = await this.contentRepo.createQueryBuilder('content')
        .leftJoin('creators', 'creator', 'creator.id = content.creatorId')
        .where('creator.hasDataConsent = :hasConsent', { hasConsent: false })
        .andWhere('content.isAuthorizedData = :isAuthorized', { isAuthorized: false })
        .select(['content.creatorId'])
        .distinct(true)
        .getRawMany();
      
      const creatorIds = nonConsentedContents.map(item => item.content_creatorId);
      
      if (creatorIds.length === 0) {
        this.logger.debug('No non-consented creators found for rolling window cleanup');
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
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const contents = await this.contentRepo.find({
        where: { creatorId },
        select: ['id', 'platform', 'isAuthorizedData', 'publishedAt']
      });
      
      const stats = {
        total: contents.length,
        authorized: contents.filter(c => c.isAuthorizedData).length,
        nonAuthorized: contents.filter(c => !c.isAuthorizedData).length,
        within30Days: contents.filter(c => c.publishedAt > thirtyDaysAgo).length,
        older30Days: contents.filter(c => c.publishedAt <= thirtyDaysAgo).length,
        platformBreakdown: {} as Record<string, { authorized: number; nonAuthorized: number }>
      };
      
      // 플랫폼별 통계
      contents.forEach(content => {
        if (!stats.platformBreakdown[content.platform]) {
          stats.platformBreakdown[content.platform] = { authorized: 0, nonAuthorized: 0 };
        }
        
        if (content.isAuthorizedData) {
          stats.platformBreakdown[content.platform].authorized++;
        } else {
          stats.platformBreakdown[content.platform].nonAuthorized++;
        }
      });
      
      this.logger.debug('Creator data retention stats calculated', {
        creatorId,
        ...stats
      });
      
      return stats;
    } catch (error: unknown) {
      this.logger.error('Failed to get creator data retention stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId
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
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

      const [expiredContents, expiringSoonContents] = await Promise.all([
        this.contentRepo.find({
          where: { expiresAt: LessThan(now) },
          select: ['id', 'platform']
        }),
        this.contentRepo.find({
          where: { 
            expiresAt: And(
              MoreThan(now),
              LessThan(sevenDaysFromNow)
            )
          },
          select: ['id', 'platform']
        })
      ]);

      const platformBreakdown = expiredContents.reduce((acc, content) => {
        acc[content.platform] = (acc[content.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalExpired: expiredContents.length,
        expiringSoon: expiringSoonContents.length,
        platformBreakdown
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
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const [oldData, recentData] = await Promise.all([
        this.contentRepo.find({
          where: {
            creatorId,
            isAuthorizedData: false,
            publishedAt: LessThan(thirtyDaysAgo)
          },
          order: { publishedAt: 'ASC' },
          select: ['id', 'publishedAt']
        }),
        this.contentRepo.find({
          where: {
            creatorId,
            isAuthorizedData: false,
            publishedAt: MoreThan(thirtyDaysAgo)
          },
          select: ['id']
        })
      ]);
      
      const needsCleanup = oldData.length > 0;
      const oldestDataDate = oldData.length > 0 ? oldData[0].publishedAt : null;
      
      this.logger.debug('Rolling window status checked', {
        creatorId,
        needsCleanup,
        oldDataCount: oldData.length,
        oldestDataDate,
        recentDataCount: recentData.length,
        cutoffDate: thirtyDaysAgo
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

  // ==================== PRIVATE HELPER METHODS ====================


  // 🔥 사용자 상호작용 정보 조회 (TODO: UserInteractionService 구현 후)
  private async getUserInteractionsByContentIds(
    userId: string, 
    contentIds: string[]
  ): Promise<Record<string, any>> {
    // TODO: UserInteractionService 구현 후 활성화
    return {};
  }

  // 🔥 콘텐츠 검색 결과 빌드 (데이터 정규화 기반)
  private buildContentSearchResults(
    contents: Partial<ContentEntity>[],
    userInteractions: Record<string, any>,
    userId?: string
  ): ContentSearchResultDto[] {
    return contents.map((content) => {
      const interaction = userInteractions[content.id!];

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
        statistics: content.statistics!, // 🔥 통계 정보
        // 🔥 크리에이터 정보는 별도 API 호출로 조회 (데이터 정규화)
        // 🔥 사용자 상호작용 정보 (userId가 있을 때만)
        isBookmarked: userId ? (interaction?.isBookmarked || false) : undefined,
        isLiked: userId ? (interaction?.isLiked || false) : undefined,
        watchedAt: userId ? interaction?.watchedAt : undefined,
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
      metadata: content.metadata!,
      statistics: content.statistics!,
      // 🔥 크리에이터 정보는 별도 API 호출로 조회 (폴백)
      // 🔥 사용자 상호작용 정보 기본값
      isBookmarked: undefined,
      isLiked: undefined,
      watchedAt: undefined,
      rating: undefined,
    }));
  }
}