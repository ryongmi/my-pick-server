import { Injectable, Logger } from '@nestjs/common';

import { CreatorCategoryStatisticsRepository } from '../repositories/index.js';
import { CreatorCategoryStatisticsEntity } from '../entities/index.js';

@Injectable()
export class CreatorCategoryStatisticsService {
  private readonly logger = new Logger(CreatorCategoryStatisticsService.name);

  constructor(private readonly categoryStatsRepo: CreatorCategoryStatisticsRepository) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * 크리에이터의 모든 카테고리 통계 조회
   */
  async findByCreatorId(creatorId: string): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.categoryStatsRepo.findByCreatorId(creatorId);
  }

  /**
   * 여러 크리에이터의 카테고리 통계 배치 조회
   */
  async findByCreatorIds(creatorIds: string[]): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.categoryStatsRepo.findByCreatorIds(creatorIds);
  }

  /**
   * 크리에이터의 주요 카테고리 조회
   */
  async getTopCategories(creatorId: string, limit = 5): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.categoryStatsRepo.findTopCategoriesForCreator(creatorId, limit);
  }

  /**
   * 크리에이터의 카테고리 성과 요약
   */
  async getCategoryPerformanceSummary(creatorId: string): Promise<{
    totalCategories: number;
    topCategory: string | null;
    totalCategoryContent: number;
    totalCategoryViews: number;
    averageViewsPerCategory: number;
  }> {
    try {
      return await this.categoryStatsRepo.getCategoryPerformanceSummary(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get category performance summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      // 실패 시 기본값 반환
      return {
        totalCategories: 0,
        topCategory: null,
        totalCategoryContent: 0,
        totalCategoryViews: 0,
        averageViewsPerCategory: 0,
      };
    }
  }

  /**
   * 카테고리별 통계 업데이트
   */
  async updateCategoryStats(
    creatorId: string,
    category: string,
    stats: {
      contentCount?: number;
      viewCount?: number;
      averageViews?: number;
      totalLikes?: number;
      totalComments?: number;
      totalShares?: number;
      averageEngagementRate?: number;
      contentGrowthRate?: number;
      viewGrowthRate?: number;
    }
  ): Promise<void> {
    try {
      await this.categoryStatsRepo.upsertStatistics(creatorId, category, stats);

      this.logger.debug('Category statistics updated', {
        creatorId,
        category,
        statsKeys: Object.keys(stats),
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update category statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        category,
      });
      throw error;
    }
  }

  /**
   * 특정 카테고리의 상위 크리에이터 조회
   */
  async getTopCreatorsByCategory(
    category: string,
    limit = 100
  ): Promise<CreatorCategoryStatisticsEntity[]> {
    try {
      return await this.categoryStatsRepo.findTopByCategory(category, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get top creators by category', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
        limit,
      });
      return [];
    }
  }

  /**
   * 카테고리별 글로벌 랭킹 조회
   */
  async getGlobalCategoryRankings(limit = 50): Promise<
    {
      category: string;
      totalCreators: number;
      totalContent: number;
      totalViews: number;
      averageEngagement: number;
    }[]
  > {
    try {
      return await this.categoryStatsRepo.getGlobalCategoryRankings(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get global category rankings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return [];
    }
  }

  // ==================== 배치 처리 메서드 ====================

  /**
   * 여러 크리에이터의 카테고리 통계를 creatorId별로 그룹화
   */
  async groupCategoryStatsByCreatorId(
    creatorIds: string[]
  ): Promise<Record<string, CreatorCategoryStatisticsEntity[]>> {
    const categoryStats = await this.findByCreatorIds(creatorIds);

    const groupedStats: Record<string, CreatorCategoryStatisticsEntity[]> = {};

    // 모든 creatorId를 빈 배열로 초기화
    creatorIds.forEach((creatorId) => {
      groupedStats[creatorId] = [];
    });

    // 카테고리 통계를 creatorId별로 그룹화
    categoryStats.forEach((stats) => {
      groupedStats[stats.creatorId]!.push(stats);
    });

    return groupedStats;
  }

  /**
   * 여러 크리에이터의 카테고리 성과 요약 배치 조회
   */
  async getCategoryPerformanceSummaryBatch(creatorIds: string[]): Promise<
    Record<
      string,
      {
        totalCategories: number;
        topCategory: string | null;
        totalCategoryContent: number;
        totalCategoryViews: number;
        averageViewsPerCategory: number;
      }
    >
  > {
    const result: Record<string, {
      totalCategories: number;
      topCategory: string | null;
      totalCategoryContent: number;
      totalCategoryViews: number;
      averageViewsPerCategory: number;
    }> = {};

    // 각 크리에이터의 카테고리 성과 요약을 개별적으로 계산
    for (const creatorId of creatorIds) {
      result[creatorId] = await this.getCategoryPerformanceSummary(creatorId);
    }

    return result;
  }
}
