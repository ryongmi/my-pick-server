import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorPlatformStatisticsEntity } from '../entities/index.js';

@Injectable()
export class CreatorPlatformStatisticsRepository extends BaseRepository<CreatorPlatformStatisticsEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorPlatformStatisticsEntity, dataSource);
  }

  // ==================== 배치 조회 메서드 ====================

  /**
   * 여러 크리에이터의 플랫폼별 통계 조회
   */
  async findByCreatorIds(creatorIds: string[]): Promise<CreatorPlatformStatisticsEntity[]> {
    if (creatorIds.length === 0) return [];

    return await this.find({
      where: {
        creatorId: this.dataSource.createQueryBuilder()
          .select()
          .from('creator_platform_statistics', 'cps')
          .where('cps.creatorId IN (:...creatorIds)', { creatorIds })
          .getQuery()
      },
      order: { creatorId: 'ASC', platform: 'ASC' }
    });
  }

  /**
   * 특정 크리에이터의 모든 플랫폼 통계 조회
   */
  async findByCreatorId(creatorId: string): Promise<CreatorPlatformStatisticsEntity[]> {
    return await this.find({
      where: { creatorId },
      order: { platform: 'ASC' }
    });
  }

  /**
   * 특정 플랫폼의 모든 크리에이터 통계 조회 (상위 N개)
   */
  async findTopByPlatform(platform: string, limit = 100): Promise<CreatorPlatformStatisticsEntity[]> {
    return await this.find({
      where: { platform },
      order: { followers: 'DESC' },
      take: limit
    });
  }

  // ==================== 집계 메서드 ====================

  /**
   * 크리에이터의 전체 플랫폼 통합 통계 계산
   */
  async getAggregatedStatsForCreator(creatorId: string): Promise<{
    totalFollowers: number;
    totalContent: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    averageEngagementRate: number;
    activePlatformCount: number;
  }> {
    const queryBuilder = this.createQueryBuilder('cps')
      .select([
        'SUM(cps.followers) AS totalFollowers',
        'SUM(cps.content) AS totalContent', 
        'SUM(cps.views) AS totalViews',
        'SUM(cps.likes) AS totalLikes',
        'SUM(cps.comments) AS totalComments',
        'SUM(cps.shares) AS totalShares',
        'AVG(cps.engagementRate) AS averageEngagementRate',
        'COUNT(*) AS activePlatformCount'
      ])
      .where('cps.creatorId = :creatorId', { creatorId });

    const result = await queryBuilder.getRawOne();

    return {
      totalFollowers: parseInt(result?.totalFollowers || '0'),
      totalContent: parseInt(result?.totalContent || '0'),
      totalViews: parseInt(result?.totalViews || '0'),
      totalLikes: parseInt(result?.totalLikes || '0'),
      totalComments: parseInt(result?.totalComments || '0'),
      totalShares: parseInt(result?.totalShares || '0'),
      averageEngagementRate: parseFloat(result?.averageEngagementRate || '0'),
      activePlatformCount: parseInt(result?.activePlatformCount || '0')
    };
  }

  /**
   * 플랫폼별 통계 업데이트 또는 생성
   */
  async upsertStatistics(
    creatorId: string, 
    platform: string, 
    stats: Partial<Omit<CreatorPlatformStatisticsEntity, 'creatorId' | 'platform' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await this.createQueryBuilder()
      .insert()
      .into(CreatorPlatformStatisticsEntity)
      .values({
        creatorId,
        platform,
        ...stats,
        lastCalculatedAt: new Date()
      })
      .orUpdate(['followers', 'content', 'views', 'likes', 'comments', 'shares', 'engagementRate', 'averageViews', 'lastCalculatedAt'], ['creatorId', 'platform'])
      .execute();
  }
}