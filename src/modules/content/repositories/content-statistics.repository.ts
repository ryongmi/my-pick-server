import { Injectable } from '@nestjs/common';

import { DataSource, In, MoreThan, LessThan, And, Between } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentStatisticsEntity } from '../entities/content-statistics.entity.js';

export interface StatisticsSearchOptions {
  minViews?: number;
  maxViews?: number;
  minLikes?: number;
  maxLikes?: number;
  minEngagementRate?: number;
  maxEngagementRate?: number;
  page?: number;
  limit?: LimitType;
  sortBy?: 'views' | 'likes' | 'comments' | 'shares' | 'engagementRate' | 'updatedAt';
  sortOrder?: SortOrderType;
}

@Injectable()
export class ContentStatisticsRepository extends BaseRepository<ContentStatisticsEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentStatisticsEntity, dataSource);
  }

  // ==================== 기본 조회는 서비스에서 BaseRepository 직접 사용 ====================

  async searchStatistics(
    options: StatisticsSearchOptions
  ): Promise<PaginatedResult<ContentStatisticsEntity>> {
    const {
      minViews,
      maxViews,
      minLikes,
      maxLikes,
      minEngagementRate,
      maxEngagementRate,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortBy = 'views',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const statsAlias = 'stats';

    const qb = this.createQueryBuilder(statsAlias);

    if (minViews !== undefined) {
      qb.andWhere(`${statsAlias}.views >= :minViews`, { minViews });
    }

    if (maxViews !== undefined) {
      qb.andWhere(`${statsAlias}.views <= :maxViews`, { maxViews });
    }

    if (minLikes !== undefined) {
      qb.andWhere(`${statsAlias}.likes >= :minLikes`, { minLikes });
    }

    if (maxLikes !== undefined) {
      qb.andWhere(`${statsAlias}.likes <= :maxLikes`, { maxLikes });
    }

    if (minEngagementRate !== undefined) {
      qb.andWhere(`${statsAlias}.engagementRate >= :minEngagementRate`, { minEngagementRate });
    }

    if (maxEngagementRate !== undefined) {
      qb.andWhere(`${statsAlias}.engagementRate <= :maxEngagementRate`, { maxEngagementRate });
    }

    qb.orderBy(`${statsAlias}.${sortBy}`, sortOrder);
    qb.offset(skip).limit(limit);

    const [items, total] = await Promise.all([qb.getMany(), qb.getCount()]);

    const totalPages = Math.ceil(total / limit);
    const pageInfo = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return { items, pageInfo };
  }

  // ==================== 통계 집계 메서드 ====================

  async getTotalViewsByCreator(creatorId: string): Promise<number> {
    const result = await this.createQueryBuilder('stats')
      .leftJoin('content', 'content', 'content.id = stats.contentId')
      .select('SUM(stats.views)', 'totalViews')
      .where('content.creatorId = :creatorId', { creatorId })
      .getRawOne();

    return Number(result?.totalViews) || 0;
  }

  async getTotalLikesByCreator(creatorId: string): Promise<number> {
    const result = await this.createQueryBuilder('stats')
      .leftJoin('content', 'content', 'content.id = stats.contentId')
      .select('SUM(stats.likes)', 'totalLikes')
      .where('content.creatorId = :creatorId', { creatorId })
      .getRawOne();

    return Number(result?.totalLikes) || 0;
  }

  async getAverageEngagementByCreator(creatorId: string): Promise<number> {
    const result = await this.createQueryBuilder('stats')
      .leftJoin('content', 'content', 'content.id = stats.contentId')
      .select('AVG(stats.engagementRate)', 'avgEngagement')
      .where('content.creatorId = :creatorId', { creatorId })
      .getRawOne();

    return Number(result?.avgEngagement) || 0;
  }

  // ==================== 단순 정렬은 서비스에서 BaseRepository 직접 사용 ====================

  async getTrendingContent(
    hours: number = 24,
    limit: number = 50
  ): Promise<ContentStatisticsEntity[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.find({
      where: {
        updatedAt: MoreThan(hoursAgo),
      },
      order: {
        views: 'DESC',
        likes: 'DESC',
        engagementRate: 'DESC',
      },
      take: limit,
    });
  }

  // ==================== 배치 처리 메서드 ====================

  async getStatisticsBatch(contentIds: string[]): Promise<Record<string, ContentStatisticsEntity>> {
    if (contentIds.length === 0) return {};

    const statistics = await this.find({
      where: { contentId: In(contentIds) },
    });

    const result: Record<string, ContentStatisticsEntity> = {};
    statistics.forEach((stat) => {
      result[stat.contentId] = stat;
    });

    return result;
  }

  async batchCreateStatistics(statistics: Partial<ContentStatisticsEntity>[]): Promise<void> {
    if (statistics.length === 0) return;

    await this.createQueryBuilder()
      .insert()
      .into(ContentStatisticsEntity)
      .values(statistics)
      .orIgnore() // 이미 존재하는 경우 무시
      .execute();
  }

  async batchUpdateViews(updates: Array<{ contentId: string; views: number }>): Promise<void> {
    if (updates.length === 0) return;

    // 배치 업데이트를 위한 트랜잭션 처리
    await this.dataSource.transaction(async (manager) => {
      for (const update of updates) {
        await manager.update(
          ContentStatisticsEntity,
          { contentId: update.contentId },
          { views: update.views, updatedAt: new Date() }
        );
      }
    });
  }

  // ==================== 통계 분석 메서드 ====================

  async getContentCountByViewRange(minViews: number, maxViews: number): Promise<number> {
    return this.count({
      where: {
        views: Between(minViews, maxViews),
      },
    });
  }

  async getEngagementRateDistribution(): Promise<Array<{ range: string; count: number }>> {
    const ranges = [
      { min: 0, max: 1, label: '0-1%' },
      { min: 1, max: 5, label: '1-5%' },
      { min: 5, max: 10, label: '5-10%' },
      { min: 10, max: 20, label: '10-20%' },
      { min: 20, max: 100, label: '20%+' },
    ];

    const distribution = await Promise.all(
      ranges.map(async (range) => ({
        range: range.label,
        count: await this.count({
          where: {
            engagementRate: Between(range.min, range.max),
          },
        }),
      }))
    );

    return distribution;
  }

  // ==================== 단순 카운트/존재확인은 서비스에서 BaseRepository 직접 사용 ====================

  async getOverallStats(): Promise<{
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    averageEngagementRate: number;
  }> {
    const result = await this.createQueryBuilder('stats')
      .select([
        'SUM(stats.views) as totalViews',
        'SUM(stats.likes) as totalLikes',
        'SUM(stats.comments) as totalComments',
        'SUM(stats.shares) as totalShares',
        'AVG(stats.engagementRate) as averageEngagementRate',
      ])
      .getRawOne();

    return {
      totalViews: Number(result?.totalViews) || 0,
      totalLikes: Number(result?.totalLikes) || 0,
      totalComments: Number(result?.totalComments) || 0,
      totalShares: Number(result?.totalShares) || 0,
      averageEngagementRate: Number(result?.averageEngagementRate) || 0,
    };
  }
}
