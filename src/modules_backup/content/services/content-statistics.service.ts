import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In } from 'typeorm';

import { ContentStatisticsRepository } from '../repositories/content-statistics.repository.js';
import { ContentStatisticsEntity } from '../entities/content-statistics.entity.js';
import { ContentException } from '../exceptions/content.exception.js';

export interface UpdateContentStatisticsDto {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagementRate?: number;
}

export interface CreatorStatsDto {
  totalViews: number;
  totalLikes: number;
  averageEngagementRate: number;
  contentCount: number;
}

export interface StatisticsUpdate {
  contentId: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

@Injectable()
export class ContentStatisticsService {
  private readonly logger = new Logger(ContentStatisticsService.name);

  constructor(private readonly statisticsRepo: ContentStatisticsRepository) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByContentId(contentId: string): Promise<ContentStatisticsEntity | null> {
    return this.statisticsRepo.findOne({ where: { contentId } });
  }

  async findByContentIds(contentIds: string[]): Promise<ContentStatisticsEntity[]> {
    if (contentIds.length === 0) return [];
    return this.statisticsRepo.find({
      where: { contentId: In(contentIds) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByContentIdOrFail(contentId: string): Promise<ContentStatisticsEntity> {
    const statistics = await this.findByContentId(contentId);
    if (!statistics) {
      this.logger.warn('Content statistics not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return statistics;
  }

  // ==================== 통계 데이터 관리 ====================

  async createStatistics(
    contentId: string,
    initialStats?: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 통계 레코드 확인
      const existing = await this.statisticsRepo.findOne({ where: { contentId } });
      if (existing) {
        this.logger.warn('Statistics record already exists', { contentId });
        return; // 이미 존재하면 스킵
      }

      const statistics = new ContentStatisticsEntity();
      statistics.contentId = contentId;
      statistics.views = initialStats?.views || 0;
      statistics.likes = initialStats?.likes || 0;
      statistics.comments = initialStats?.comments || 0;
      statistics.shares = initialStats?.shares || 0;
      statistics.engagementRate = this.calculateEngagementRate(
        statistics.views,
        statistics.likes,
        statistics.comments,
        statistics.shares
      );

      const repository = transactionManager
        ? transactionManager.getRepository(ContentStatisticsEntity)
        : this.statisticsRepo;

      await (transactionManager
        ? repository.save(statistics)
        : this.statisticsRepo.saveEntity(statistics));

      this.logger.log('Content statistics created', {
        contentId,
        initialViews: statistics.views,
        initialLikes: statistics.likes,
      });
    } catch (error: unknown) {
      this.logger.error('Content statistics creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  async updateStatistics(
    contentId: string,
    dto: UpdateContentStatisticsDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const repository = transactionManager
        ? transactionManager.getRepository(ContentStatisticsEntity)
        : this.statisticsRepo;

      let statistics = await (transactionManager
        ? repository.findOne({ where: { contentId } })
        : this.statisticsRepo.findOne({ where: { contentId } }));

      if (statistics) {
        // 기존 레코드 업데이트
        Object.assign(statistics, dto);

        // 참여율 재계산
        if (
          dto.views !== undefined ||
          dto.likes !== undefined ||
          dto.comments !== undefined ||
          dto.shares !== undefined
        ) {
          statistics.engagementRate = this.calculateEngagementRate(
            statistics.views,
            statistics.likes,
            statistics.comments,
            statistics.shares
          );
        }
      } else {
        // 새 레코드 생성
        statistics = new ContentStatisticsEntity();
        statistics.contentId = contentId;
        Object.assign(statistics, dto);
        statistics.engagementRate = this.calculateEngagementRate(
          statistics.views || 0,
          statistics.likes || 0,
          statistics.comments || 0,
          statistics.shares || 0
        );
      }

      await (transactionManager
        ? repository.save(statistics)
        : this.statisticsRepo.saveEntity(statistics));

      this.logger.log('Content statistics updated', {
        contentId,
        updatedFields: Object.keys(dto),
        engagementRate: statistics.engagementRate,
      });
    } catch (error: unknown) {
      this.logger.error('Content statistics update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  async incrementViews(contentId: string, increment: number = 1): Promise<void> {
    try {
      const statistics = await this.findByContentIdOrFail(contentId);

      statistics.views = Number(statistics.views) + increment;
      statistics.engagementRate = this.calculateEngagementRate(
        statistics.views,
        statistics.likes,
        statistics.comments,
        statistics.shares
      );

      await this.statisticsRepo.saveEntity(statistics);

      this.logger.debug('Content views incremented', {
        contentId,
        increment,
        totalViews: statistics.views,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content views increment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        increment,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  async incrementLikes(contentId: string, increment: number = 1): Promise<void> {
    try {
      const statistics = await this.findByContentIdOrFail(contentId);

      statistics.likes = statistics.likes + increment;
      statistics.engagementRate = this.calculateEngagementRate(
        statistics.views,
        statistics.likes,
        statistics.comments,
        statistics.shares
      );

      await this.statisticsRepo.saveEntity(statistics);

      this.logger.debug('Content likes incremented', {
        contentId,
        increment,
        totalLikes: statistics.likes,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content likes increment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        increment,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async getStatisticsBatch(contentIds: string[]): Promise<Record<string, ContentStatisticsEntity>> {
    try {
      if (contentIds.length === 0) return {};

      const statistics = await this.statisticsRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<string, ContentStatisticsEntity> = {};
      statistics.forEach((stat) => {
        result[stat.contentId] = stat;
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch statistics batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  async batchUpdateStatistics(updates: StatisticsUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    try {
      // 각 업데이트를 개별적으로 처리하여 참여율 계산 포함
      await Promise.all(
        updates.map(async (update) => {
          const { contentId, ...statsData } = update;
          await this.updateStatistics(contentId, statsData);
        })
      );

      this.logger.log('Batch statistics update completed', {
        updateCount: updates.length,
      });
    } catch (error: unknown) {
      this.logger.error('Batch statistics update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updateCount: updates.length,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  async batchCreateStatistics(
    statisticsData: Array<{
      contentId: string;
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
    }>
  ): Promise<void> {
    if (statisticsData.length === 0) return;

    try {
      const statistics = statisticsData.map((data) => ({
        contentId: data.contentId,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        engagementRate: this.calculateEngagementRate(
          data.views || 0,
          data.likes || 0,
          data.comments || 0,
          data.shares || 0
        ),
      }));

      await this.statisticsRepo.batchCreateStatistics(statistics);

      this.logger.log('Batch statistics creation completed', {
        createCount: statisticsData.length,
      });
    } catch (error: unknown) {
      this.logger.error('Batch statistics creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        createCount: statisticsData.length,
      });
      throw ContentException.statisticsUpdateError();
    }
  }

  // ==================== 통계 조회 및 분석 ====================

  async getCreatorTotalStats(creatorId: string): Promise<CreatorStatsDto> {
    try {
      const [totalViews, totalLikes, averageEngagementRate] = await Promise.all([
        this.statisticsRepo.getTotalViewsByCreator(creatorId),
        this.statisticsRepo.getTotalLikesByCreator(creatorId),
        this.statisticsRepo.getAverageEngagementByCreator(creatorId),
      ]);

      // ContentService에서 콘텐츠 수 조회 (순환 의존성 방지를 위해 별도 조회 필요)
      // 향후 ContentRepository를 직접 주입하거나 별도 이벤트 기반으로 구현
      const contentCount = 0; // 순환 의존성으로 인해 현재 미구현

      return {
        totalViews,
        totalLikes,
        averageEngagementRate: Number(averageEngagementRate.toFixed(2)),
        contentCount,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get creator total stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTopContentByViews(limit: number = 10): Promise<ContentStatisticsEntity[]> {
    try {
      return await this.statisticsRepo.find({
        order: { views: 'DESC' },
        take: limit,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get top content by views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTopContentByLikes(limit: number = 10): Promise<ContentStatisticsEntity[]> {
    try {
      return await this.statisticsRepo.find({
        order: { likes: 'DESC' },
        take: limit,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get top content by likes', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getTrendingContent(
    hours: number = 24,
    limit: number = 50
  ): Promise<ContentStatisticsEntity[]> {
    try {
      return await this.statisticsRepo.getTrendingContent(hours, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get trending content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hours,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getOverallStats(): Promise<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    averageEngagementRate: number;
  }> {
    try {
      return await this.statisticsRepo.getOverallStats();
    } catch (error: unknown) {
      this.logger.error('Failed to get overall stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 관리자용 통계 메서드 ====================

  async getTotalViewsByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.statisticsRepo.getTotalViewsByCreator(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get total views by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getTotalLikesByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.statisticsRepo.getTotalLikesByCreator(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get total likes by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getAverageEngagementByCreatorId(creatorId: string): Promise<number> {
    try {
      return await this.statisticsRepo.getAverageEngagementByCreator(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get average engagement by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  async getContentCountByPlatform(platform: string): Promise<Record<string, number>> {
    try {
      // ContentStatisticsRepository에 해당 메서드가 없으므로 대안 구현
      const statistics = await this.statisticsRepo.find();
      const result: Record<string, number> = {};
      
      statistics.forEach(_stat => {
        // 플랫폼별 집계는 ContentStatistics에서 직접 계산하기 어려우므로 기본값 반환
        result[platform] = result[platform] ? result[platform] + 1 : 1;
      });
      
      return result;
    } catch (error: unknown) {
      this.logger.error('Failed to get content count by platform', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
      });
      return {};
    }
  }

  // ==================== 최적화 메서드 ====================

  async hasStatistics(contentId: string): Promise<boolean> {
    try {
      return await this.statisticsRepo.exists({ contentId });
    } catch (error: unknown) {
      this.logger.error('Failed to check statistics existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return false;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      return await this.statisticsRepo.count();
    } catch (error: unknown) {
      this.logger.error('Failed to get total statistics count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private calculateEngagementRate(
    views: number,
    likes: number,
    comments: number,
    shares: number
  ): number {
    if (views === 0) return 0;

    const totalEngagements = likes + comments + shares;
    const rate = (totalEngagements / views) * 100;

    return Number(rate.toFixed(2));
  }
}
