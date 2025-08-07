import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorCategoryStatisticsEntity } from '../entities/index.js';

@Injectable()
export class CreatorCategoryStatisticsRepository extends BaseRepository<CreatorCategoryStatisticsEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorCategoryStatisticsEntity, dataSource);
  }

  // ==================== 배치 조회 메서드 ====================

  /**
   * 여러 크리에이터의 카테고리별 통계 조회
   */
  async findByCreatorIds(creatorIds: string[]): Promise<CreatorCategoryStatisticsEntity[]> {
    if (creatorIds.length === 0) return [];

    return await this.find({
      where: {
        creatorId: this.dataSource.createQueryBuilder()
          .select()
          .from('creator_category_statistics', 'ccs')
          .where('ccs.creatorId IN (:...creatorIds)', { creatorIds })
          .getQuery()
      },
      order: { creatorId: 'ASC', category: 'ASC' }
    });
  }

  /**
   * 특정 크리에이터의 모든 카테고리 통계 조회
   */
  async findByCreatorId(creatorId: string): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.find({
      where: { creatorId },
      order: { contentCount: 'DESC' }
    });
  }

  /**
   * 특정 카테고리의 모든 크리에이터 통계 조회 (상위 N개)
   */
  async findTopByCategory(category: string, limit = 100): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.find({
      where: { category },
      order: { viewCount: 'DESC' },
      take: limit
    });
  }

  /**
   * 크리에이터의 주요 카테고리 조회 (콘텐츠 수 기준 상위 N개)
   */
  async findTopCategoriesForCreator(creatorId: string, limit = 5): Promise<CreatorCategoryStatisticsEntity[]> {
    return await this.find({
      where: { creatorId },
      order: { contentCount: 'DESC' },
      take: limit
    });
  }

  // ==================== 집계 메서드 ====================

  /**
   * 크리에이터의 카테고리별 성과 요약
   */
  async getCategoryPerformanceSummary(creatorId: string): Promise<{
    totalCategories: number;
    topCategory: string | null;
    totalCategoryContent: number;
    totalCategoryViews: number;
    averageViewsPerCategory: number;
  }> {
    const queryBuilder = this.createQueryBuilder('ccs')
      .select([
        'COUNT(*) AS totalCategories',
        'SUM(ccs.contentCount) AS totalCategoryContent',
        'SUM(ccs.viewCount) AS totalCategoryViews',
        'AVG(ccs.averageViews) AS averageViewsPerCategory'
      ])
      .where('ccs.creatorId = :creatorId', { creatorId });

    const result = await queryBuilder.getRawOne();

    // 가장 많은 콘텐츠를 가진 카테고리 조회
    const topCategoryResult = await this.findOne({
      where: { creatorId },
      order: { contentCount: 'DESC' }
    });

    return {
      totalCategories: parseInt(result?.totalCategories || '0'),
      topCategory: topCategoryResult?.category || null,
      totalCategoryContent: parseInt(result?.totalCategoryContent || '0'),
      totalCategoryViews: parseInt(result?.totalCategoryViews || '0'),
      averageViewsPerCategory: parseFloat(result?.averageViewsPerCategory || '0')
    };
  }

  /**
   * 카테고리별 통계 업데이트 또는 생성
   */
  async upsertStatistics(
    creatorId: string, 
    category: string, 
    stats: Partial<Omit<CreatorCategoryStatisticsEntity, 'creatorId' | 'category' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await this.createQueryBuilder()
      .insert()
      .into(CreatorCategoryStatisticsEntity)
      .values({
        creatorId,
        category,
        ...stats,
        lastCalculatedAt: new Date()
      })
      .orUpdate([
        'contentCount', 
        'viewCount', 
        'averageViews', 
        'totalLikes', 
        'totalComments', 
        'totalShares', 
        'averageEngagementRate', 
        'contentGrowthRate', 
        'viewGrowthRate', 
        'lastCalculatedAt'
      ], ['creatorId', 'category'])
      .execute();
  }

  /**
   * 카테고리별 글로벌 랭킹 (모든 크리에이터)
   */
  async getGlobalCategoryRankings(limit = 50): Promise<{
    category: string;
    totalCreators: number;
    totalContent: number;
    totalViews: number;
    averageEngagement: number;
  }[]> {
    const queryBuilder = this.createQueryBuilder('ccs')
      .select([
        'ccs.category AS category',
        'COUNT(DISTINCT ccs.creatorId) AS totalCreators',
        'SUM(ccs.contentCount) AS totalContent',
        'SUM(ccs.viewCount) AS totalViews',
        'AVG(ccs.averageEngagementRate) AS averageEngagement'
      ])
      .groupBy('ccs.category')
      .orderBy('totalViews', 'DESC')
      .limit(limit);

    const results = await queryBuilder.getRawMany();

    return results.map(result => ({
      category: result.category,
      totalCreators: parseInt(result.totalCreators),
      totalContent: parseInt(result.totalContent),
      totalViews: parseInt(result.totalViews),
      averageEngagement: parseFloat(result.averageEngagement || '0')
    }));
  }
}