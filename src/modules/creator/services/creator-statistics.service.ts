import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { CreatorStatisticsRepository } from '../repositories/creator-statistics.repository.js';
import { CreatorStatisticsEntity } from '../entities/creator-statistics.entity.js';
import { CreatorException } from '../exceptions/index.js';

@Injectable()
export class CreatorStatisticsService {
  private readonly logger = new Logger(CreatorStatisticsService.name);

  constructor(
    private readonly statisticsRepo: CreatorStatisticsRepository,
  ) {}

  // ==================== PUBLIC METHODS ====================

  async findByCreatorId(creatorId: string): Promise<CreatorStatisticsEntity | null> {
    try {
      return await this.statisticsRepo.findByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to find creator statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return null;
    }
  }

  async findByCreatorIdOrFail(creatorId: string): Promise<CreatorStatisticsEntity> {
    const statistics = await this.findByCreatorId(creatorId);
    
    if (!statistics) {
      this.logger.warn('Creator statistics not found', { creatorId });
      throw CreatorException.statisticsNotFound();
    }

    return statistics;
  }

  async getCreatorStatistics(creatorId: string): Promise<{
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    followersGrowthRate: number;
    contentGrowthRate: number;
    averageEngagementRate: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    platformStats?: Record<string, any>;
    categoryStats?: Record<string, any>;
    monthlyAverageViews?: number;
    contentQualityScore?: number;
    activePlatformCount: number;
    lastCalculatedAt?: Date;
  }> {
    try {
      const statistics = await this.findByCreatorId(creatorId);
      
      if (!statistics) {
        // 통계가 없는 경우 기본값 반환
        return {
          totalFollowers: 0,
          totalContent: 0,
          totalViews: 0,
          followersGrowthRate: 0,
          contentGrowthRate: 0,
          averageEngagementRate: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          activePlatformCount: 0,
        };
      }

      return {
        totalFollowers: statistics.totalFollowers,
        totalContent: statistics.totalContent,
        totalViews: statistics.totalViews,
        followersGrowthRate: statistics.followersGrowthRate,
        contentGrowthRate: statistics.contentGrowthRate,
        averageEngagementRate: statistics.averageEngagementRate,
        totalLikes: statistics.totalLikes,
        totalComments: statistics.totalComments,
        totalShares: statistics.totalShares,
        platformStats: statistics.platformStats,
        categoryStats: statistics.categoryStats,
        monthlyAverageViews: statistics.monthlyAverageViews,
        contentQualityScore: statistics.contentQualityScore,
        activePlatformCount: statistics.activePlatformCount,
        lastCalculatedAt: statistics.lastCalculatedAt,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get creator statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.statisticsFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createOrUpdateStatistics(
    creatorId: string,
    statisticsData: {
      totalFollowers?: number;
      totalContent?: number;
      totalViews?: number;
      followersGrowthRate?: number;
      contentGrowthRate?: number;
      averageEngagementRate?: number;
      totalLikes?: number;
      totalComments?: number;
      totalShares?: number;
      platformStats?: Record<string, any>;
      categoryStats?: Record<string, any>;
      monthlyAverageViews?: number;
      contentQualityScore?: number;
      activePlatformCount?: number;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      this.logger.debug('Creating/updating creator statistics', {
        creatorId,
        hasPlatformStats: !!statisticsData.platformStats,
        hasCategoryStats: !!statisticsData.categoryStats,
      });

      const existingStats = await this.findByCreatorId(creatorId);

      if (existingStats) {
        // 기존 통계 업데이트
        await this.statisticsRepo.updateStatistics(creatorId, statisticsData);
        this.logger.debug('Creator statistics updated', { creatorId });
      } else {
        // 새 통계 생성
        await this.statisticsRepo.saveStatistics(creatorId, statisticsData);
        this.logger.debug('Creator statistics created', { creatorId });
      }

      this.logger.log('Creator statistics processed successfully', { creatorId });
    } catch (error: unknown) {
      this.logger.error('Failed to create/update creator statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  async incrementFollowers(creatorId: string, count: number = 1): Promise<void> {
    try {
      const statistics = await this.findByCreatorId(creatorId);
      
      if (statistics) {
        const newFollowerCount = statistics.totalFollowers + count;
        await this.statisticsRepo.updateStatistics(creatorId, {
          totalFollowers: newFollowerCount,
        });
        
        this.logger.debug('Creator followers incremented', {
          creatorId,
          previousCount: statistics.totalFollowers,
          increment: count,
          newCount: newFollowerCount,
        });
      } else {
        // 통계가 없으면 생성
        await this.statisticsRepo.saveStatistics(creatorId, {
          totalFollowers: count,
        });
        
        this.logger.debug('Creator statistics created with initial followers', {
          creatorId,
          initialCount: count,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to increment creator followers', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        count,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  async incrementContent(creatorId: string, count: number = 1): Promise<void> {
    try {
      const statistics = await this.findByCreatorId(creatorId);
      
      if (statistics) {
        const newContentCount = statistics.totalContent + count;
        await this.statisticsRepo.updateStatistics(creatorId, {
          totalContent: newContentCount,
        });
        
        this.logger.debug('Creator content count incremented', {
          creatorId,
          previousCount: statistics.totalContent,
          increment: count,
          newCount: newContentCount,
        });
      } else {
        // 통계가 없으면 생성
        await this.statisticsRepo.saveStatistics(creatorId, {
          totalContent: count,
        });
        
        this.logger.debug('Creator statistics created with initial content', {
          creatorId,
          initialCount: count,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to increment creator content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        count,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  async updatePlatformStatistics(
    creatorId: string,
    platform: string,
    platformData: {
      followers?: number;
      content?: number;
      views?: number;
      engagementRate?: number;
    }
  ): Promise<void> {
    try {
      const statistics = await this.findByCreatorId(creatorId);
      
      const currentPlatformStats = statistics?.platformStats || {};
      const updatedPlatformStats = {
        ...currentPlatformStats,
        [platform]: {
          ...currentPlatformStats[platform],
          ...platformData,
        },
      };

      if (statistics) {
        await this.statisticsRepo.updateStatistics(creatorId, {
          platformStats: updatedPlatformStats,
        });
      } else {
        await this.statisticsRepo.saveStatistics(creatorId, {
          platformStats: updatedPlatformStats,
          activePlatformCount: 1,
        });
      }

      this.logger.debug('Platform statistics updated', {
        creatorId,
        platform,
        hasFollowers: platformData.followers !== undefined,
        hasContent: platformData.content !== undefined,
        hasViews: platformData.views !== undefined,
        hasEngagementRate: platformData.engagementRate !== undefined,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platform,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  async calculateGrowthRates(creatorId: string): Promise<void> {
    try {
      this.logger.debug('Calculating growth rates', { creatorId });

      // TODO: 실제 성장률 계산 로직 구현
      // 1. 지난 달 통계 데이터 조회
      // 2. 현재 통계와 비교하여 성장률 계산
      // 3. 성장률 업데이트

      // 임시로 기본값 설정
      const mockGrowthRates = {
        followersGrowthRate: 5.2,
        contentGrowthRate: 12.8,
      };

      await this.statisticsRepo.updateStatistics(creatorId, mockGrowthRates);

      this.logger.log('Growth rates calculated and updated', {
        creatorId,
        ...mockGrowthRates,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to calculate growth rates', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  async deleteStatistics(creatorId: string): Promise<void> {
    try {
      await this.statisticsRepo.deleteByCreatorId(creatorId);
      this.logger.log('Creator statistics deleted', { creatorId });
    } catch (error: unknown) {
      this.logger.error('Failed to delete creator statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.statisticsUpdateError();
    }
  }

  // ==================== 통계 및 랭킹 메서드 ====================

  async getTopCreators(
    type: 'followers' | 'views' | 'engagement' = 'followers',
    limit = 10
  ): Promise<Array<{
    creatorId: string;
    value: number;
    rank: number;
  }>> {
    try {
      let topCreators: CreatorStatisticsEntity[] = [];

      switch (type) {
        case 'followers':
          topCreators = await this.statisticsRepo.getTopCreatorsByFollowers(limit);
          break;
        case 'views':
          topCreators = await this.statisticsRepo.getTopCreatorsByViews(limit);
          break;
        case 'engagement':
          topCreators = await this.statisticsRepo.getTopCreatorsByEngagement(limit);
          break;
      }

      return topCreators.map((stats, index) => ({
        creatorId: stats.creatorId,
        value: this.getStatValue(stats, type),
        rank: index + 1,
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get top creators', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        limit,
      });
      throw CreatorException.statisticsFetchError();
    }
  }

  async getGrowingCreators(
    type: 'followers' | 'content' = 'followers',
    limit = 10
  ): Promise<Array<{
    creatorId: string;
    growthRate: number;
    rank: number;
  }>> {
    try {
      const growingCreators = await this.statisticsRepo.getCreatorsByGrowthRate(limit, type);

      return growingCreators.map((stats, index) => ({
        creatorId: stats.creatorId,
        growthRate: type === 'followers' ? stats.followersGrowthRate : stats.contentGrowthRate,
        rank: index + 1,
      }));
    } catch (error: unknown) {
      this.logger.error('Failed to get growing creators', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        limit,
      });
      throw CreatorException.statisticsFetchError();
    }
  }

  async getOverallStatistics(): Promise<{
    totalCreators: number;
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    averageEngagementRate: number;
    activeCreators: number;
  }> {
    try {
      return await this.statisticsRepo.getStatisticsOverview();
    } catch (error: unknown) {
      this.logger.error('Failed to get overall statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.statisticsFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private getStatValue(stats: CreatorStatisticsEntity, type: 'followers' | 'views' | 'engagement'): number {
    switch (type) {
      case 'followers':
        return stats.totalFollowers;
      case 'views':
        return stats.totalViews;
      case 'engagement':
        return stats.averageEngagementRate;
      default:
        return 0;
    }
  }
}