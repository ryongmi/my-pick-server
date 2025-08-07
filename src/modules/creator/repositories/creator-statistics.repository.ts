import { Injectable } from '@nestjs/common';
import { DataSource, Repository, MoreThan } from 'typeorm';

import { CreatorStatisticsEntity } from '../entities/creator-statistics.entity.js';

@Injectable()
export class CreatorStatisticsRepository extends Repository<CreatorStatisticsEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorStatisticsEntity, dataSource.createEntityManager());
  }

  async findByCreatorId(creatorId: string): Promise<CreatorStatisticsEntity | null> {
    return this.findOne({ where: { creatorId } });
  }

  async saveStatistics(creatorId: string, statisticsData: {
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
    lastCalculatedAt?: Date;
  }): Promise<void> {
    const statistics = new CreatorStatisticsEntity();
    statistics.creatorId = creatorId;
    statistics.totalFollowers = statisticsData.totalFollowers || 0;
    statistics.totalContent = statisticsData.totalContent || 0;
    statistics.totalViews = statisticsData.totalViews || 0;
    statistics.followersGrowthRate = statisticsData.followersGrowthRate || 0;
    statistics.contentGrowthRate = statisticsData.contentGrowthRate || 0;
    statistics.averageEngagementRate = statisticsData.averageEngagementRate || 0;
    statistics.totalLikes = statisticsData.totalLikes || 0;
    statistics.totalComments = statisticsData.totalComments || 0;
    statistics.totalShares = statisticsData.totalShares || 0;
    statistics.platformStats = statisticsData.platformStats;
    statistics.categoryStats = statisticsData.categoryStats;
    statistics.monthlyAverageViews = statisticsData.monthlyAverageViews;
    statistics.contentQualityScore = statisticsData.contentQualityScore;
    statistics.activePlatformCount = statisticsData.activePlatformCount || 0;
    statistics.lastCalculatedAt = statisticsData.lastCalculatedAt || new Date();

    await this.save(statistics);
  }

  async updateStatistics(creatorId: string, statisticsData: Partial<{
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    followersGrowthRate: number;
    contentGrowthRate: number;
    averageEngagementRate: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    platformStats: Record<string, any>;
    categoryStats: Record<string, any>;
    monthlyAverageViews: number;
    contentQualityScore: number;
    activePlatformCount: number;
    lastCalculatedAt: Date;
  }>): Promise<void> {
    await this.update({ creatorId }, {
      ...statisticsData,
      lastCalculatedAt: new Date(),
    });
  }

  async getTopCreatorsByFollowers(limit = 10): Promise<CreatorStatisticsEntity[]> {
    return this.find({
      order: { totalFollowers: 'DESC' },
      take: limit,
    });
  }

  async getTopCreatorsByViews(limit = 10): Promise<CreatorStatisticsEntity[]> {
    return this.find({
      order: { totalViews: 'DESC' },
      take: limit,
    });
  }

  async getTopCreatorsByEngagement(limit = 10): Promise<CreatorStatisticsEntity[]> {
    return this.find({
      order: { averageEngagementRate: 'DESC' },
      take: limit,
    });
  }

  async getCreatorsByGrowthRate(limit = 10, type: 'followers' | 'content' = 'followers'): Promise<CreatorStatisticsEntity[]> {
    const orderField = type === 'followers' ? 'followersGrowthRate' : 'contentGrowthRate';
    
    return this.find({
      order: { [orderField]: 'DESC' },
      take: limit,
    });
  }

  async getStatisticsOverview(): Promise<{
    totalCreators: number;
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    averageEngagementRate: number;
    activeCreators: number;
  }> {
    const [
      totalCreators,
      aggregateStats,
      activeCreators,
    ] = await Promise.all([
      this.count(),
      this.createQueryBuilder('stats')
        .select([
          'SUM(stats.totalFollowers)', 'totalFollowers',
          'SUM(stats.totalContent)', 'totalContent', 
          'SUM(stats.totalViews)', 'totalViews',
          'AVG(stats.averageEngagementRate)', 'averageEngagementRate',
        ])
        .getRawOne(),
      this.count({
        where: {
          lastCalculatedAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30일 이내
        }
      }),
    ]);

    return {
      totalCreators,
      totalFollowers: parseInt(aggregateStats.totalFollowers) || 0,
      totalContent: parseInt(aggregateStats.totalContent) || 0,
      totalViews: parseInt(aggregateStats.totalViews) || 0,
      averageEngagementRate: parseFloat(aggregateStats.averageEngagementRate) || 0,
      activeCreators,
    };
  }

  async getCategoryStatistics(): Promise<Array<{
    category: string;
    creatorCount: number;
    totalContent: number;
    averageViews: number;
  }>> {
    const result = await this.createQueryBuilder('stats')
      .select([
        'JSON_UNQUOTE(JSON_KEYS(stats.categoryStats))', 'categories',
        'COUNT(*)', 'creatorCount',
      ])
      .groupBy('categories')
      .getRawMany();

    // TODO: JSON 필드 집계를 위한 더 복잡한 쿼리 구현 필요
    // 현재는 기본 구조만 반환
    return result.map(item => ({
      category: item.categories || 'Unknown',
      creatorCount: parseInt(item.creatorCount) || 0,
      totalContent: 0,
      averageViews: 0,
    }));
  }

  async getPlatformStatistics(): Promise<Array<{
    platform: string;
    creatorCount: number;
    totalFollowers: number;
    averageEngagement: number;
  }>> {
    // TODO: JSON 필드에서 플랫폼 통계 추출 로직 구현
    // 현재는 기본 구조만 반환
    return [
      { platform: 'youtube', creatorCount: 0, totalFollowers: 0, averageEngagement: 0 },
      { platform: 'instagram', creatorCount: 0, totalFollowers: 0, averageEngagement: 0 },
      { platform: 'twitter', creatorCount: 0, totalFollowers: 0, averageEngagement: 0 },
    ];
  }

  async getGrowthTrends(days = 30): Promise<Array<{
    date: string;
    newCreators: number;
    totalFollowersGrowth: number;
    averageEngagementRate: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // TODO: 일별 성장 트렌드 계산 로직 구현
    // 현재는 기본 구조만 반환
    return [];
  }

  async deleteByCreatorId(creatorId: string): Promise<void> {
    await this.delete({ creatorId });
  }
}