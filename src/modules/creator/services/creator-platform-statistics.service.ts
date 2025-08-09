import { Injectable, Logger } from '@nestjs/common';

import { CreatorPlatformStatisticsRepository } from '../repositories/index.js';
import { CreatorPlatformStatisticsEntity } from '../entities/index.js';

@Injectable()
export class CreatorPlatformStatisticsService {
  private readonly logger = new Logger(CreatorPlatformStatisticsService.name);

  constructor(private readonly platformStatsRepo: CreatorPlatformStatisticsRepository) {}

  // ==================== PUBLIC METHODS ====================

  /**
   * 크리에이터의 모든 플랫폼 통계 조회
   */
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformStatisticsEntity[]> {
    return await this.platformStatsRepo.findByCreatorId(creatorId);
  }

  /**
   * 여러 크리에이터의 플랫폼 통계 배치 조회
   */
  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformStatisticsEntity[]> {
    return await this.platformStatsRepo.findByCreatorIds(creatorIds);
  }

  /**
   * 크리에이터의 통합 플랫폼 통계 계산
   */
  async getAggregatedStats(creatorId: string): Promise<{
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    averageEngagementRate: number;
    activePlatformCount: number;
  }> {
    try {
      return await this.platformStatsRepo.getAggregatedStatsForCreator(creatorId);
    } catch (error: unknown) {
      this.logger.error('Failed to get aggregated platform stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      // 실패 시 기본값 반환
      return {
        totalFollowers: 0,
        totalContent: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        averageEngagementRate: 0,
        activePlatformCount: 0,
      };
    }
  }

  /**
   * 플랫폼별 통계 업데이트
   */
  async updatePlatformStats(
    creatorId: string,
    platform: string,
    stats: {
      followers?: number;
      content?: number;
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      engagementRate?: number;
      averageViews?: number;
    }
  ): Promise<void> {
    try {
      await this.platformStatsRepo.upsertStatistics(creatorId, platform, stats);

      this.logger.debug('Platform statistics updated', {
        creatorId,
        platform,
        statsKeys: Object.keys(stats),
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platform,
      });
      throw error;
    }
  }

  /**
   * 특정 플랫폼의 상위 크리에이터 조회
   */
  async getTopCreatorsByPlatform(
    platform: string,
    limit = 100
  ): Promise<CreatorPlatformStatisticsEntity[]> {
    try {
      return await this.platformStatsRepo.findTopByPlatform(platform, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get top creators by platform', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
        limit,
      });
      return [];
    }
  }

  // ==================== 배치 처리 메서드 ====================

  /**
   * 여러 크리에이터의 플랫폼 통계를 creatorId별로 그룹화
   */
  async groupPlatformStatsByCreatorId(
    creatorIds: string[]
  ): Promise<Record<string, CreatorPlatformStatisticsEntity[]>> {
    const platformStats = await this.findByCreatorIds(creatorIds);

    const groupedStats: Record<string, CreatorPlatformStatisticsEntity[]> = {};

    // 모든 creatorId를 빈 배열로 초기화
    creatorIds.forEach((creatorId) => {
      groupedStats[creatorId] = [];
    });

    // 플랫폼 통계를 creatorId별로 그룹화
    platformStats.forEach((stats) => {
      groupedStats[stats.creatorId]!.push(stats);
    });

    return groupedStats;
  }

  /**
   * 여러 크리에이터의 통합 통계 배치 계산
   */
  async getAggregatedStatsBatch(creatorIds: string[]): Promise<
    Record<
      string,
      {
        totalFollowers: number;
        totalContent: number;
        totalViews: number;
        totalLikes: number;
        totalComments: number;
        totalShares: number;
        averageEngagementRate: number;
        activePlatformCount: number;
      }
    >
  > {
    const result: Record<string, any> = {};

    // 각 크리에이터의 통합 통계를 개별적으로 계산
    for (const creatorId of creatorIds) {
      result[creatorId] = await this.getAggregatedStats(creatorId);
    }

    return result;
  }
}
