import { Injectable } from '@nestjs/common';

import { DataSource, In, EntityManager } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { PlatformType } from '@common/enums/index.js';

import { ContentEntity } from '../entities/index.js';
import { ContentType } from '../enums/index.js';

export interface ContentSearchOptions {
  creatorId?: string | undefined;
  creatorIds?: string[] | undefined;
  type?: ContentType | undefined;
  platform?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: 'publishedAt' | 'views' | 'likes' | 'createdAt' | undefined;
  sortOrder?: SortOrderType | undefined;
}

@Injectable()
export class ContentRepository extends BaseRepository<ContentEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentEntity, dataSource);
  }

  // 기본 조회 메서드들은 BaseRepository 직접 사용 (findOneById, find, findOne 등)

  async searchContent(
    options: ContentSearchOptions
  ): Promise<PaginatedResult<Partial<ContentEntity>>> {
    const {
      creatorId,
      creatorIds,
      type,
      platform,
      category,
      tags,
      startDate,
      endDate,
      page = 1,
      limit = LimitType.THIRTY,
      sortBy = 'publishedAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const contentAlias = 'content';
    const statsAlias = 'statistics';

    const qb = this.createQueryBuilder(contentAlias)
      .leftJoin(`${contentAlias}.statistics`, statsAlias)
      .select([
        `${contentAlias}.id AS id`,
        `${contentAlias}.type AS type`,
        `${contentAlias}.title AS title`,
        `${contentAlias}.description AS description`,
        `${contentAlias}.thumbnail AS thumbnail`,
        `${contentAlias}.url AS url`,
        `${contentAlias}.platform AS platform`,
        `${contentAlias}.platformId AS platformId`,
        `${contentAlias}.duration AS duration`,
        `${contentAlias}.publishedAt AS publishedAt`,
        `${contentAlias}.creatorId AS creatorId`,
        `${contentAlias}.language AS language`,
        `${contentAlias}.isLive AS isLive`,
        `${contentAlias}.quality AS quality`,
        `${contentAlias}.ageRestriction AS ageRestriction`,
        `${statsAlias}.views AS views`,
        `${statsAlias}.likes AS likes`,
        `${statsAlias}.comments AS comments`,
        `${statsAlias}.shares AS shares`,
        `${statsAlias}.engagementRate AS engagementRate`,
      ]);

    // 검색 조건 적용 (인덱스 활용 순서 고려)
    if (creatorId) {
      qb.andWhere(`${contentAlias}.creatorId = :creatorId`, { creatorId });
    }

    if (creatorIds && creatorIds.length > 0) {
      qb.andWhere(`${contentAlias}.creatorId IN (:...creatorIds)`, { creatorIds });
    }

    if (type) {
      qb.andWhere(`${contentAlias}.type = :type`, { type });
    }

    if (platform) {
      qb.andWhere(`${contentAlias}.platform = :platform`, { platform });
    }

    if (startDate) {
      qb.andWhere(`${contentAlias}.publishedAt >= :startDate`, { startDate });
    }

    if (endDate) {
      qb.andWhere(`${contentAlias}.publishedAt <= :endDate`, { endDate });
    }

    // category와 tags는 이제 별도 엔티티로 관리됨
    // 필요시 ContentCategoryEntity, ContentTagEntity와 조인하여 검색
    if (category) {
      qb.innerJoin(
        'content_categories',
        'cc',
        'cc.contentId = content.id AND cc.category = :category',
        { category }
      );
    }

    if (tags && tags.length > 0) {
      qb.innerJoin('content_tags', 'ct', 'ct.contentId = content.id AND ct.tag IN (:...tags)', {
        tags,
      });
    }

    // 정렬 조건 - statistics 필드인 경우 JOIN된 테이블 사용
    if (sortBy === 'views' || sortBy === 'likes') {
      qb.orderBy(`${statsAlias}.${sortBy}`, sortOrder);
    } else {
      qb.orderBy(`${contentAlias}.${sortBy}`, sortOrder);
    }

    qb.offset(skip).limit(limit);

    // 최적화: 병렬로 COUNT와 데이터 조회
    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    // 타입 안전한 결과 매핑
    const items: Partial<ContentEntity>[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      url: row.url,
      platform: row.platform,
      platformId: row.platformId,
      duration: row.duration,
      publishedAt: row.publishedAt,
      creatorId: row.creatorId,
      language: row.language,
      isLive: row.isLive,
      quality: row.quality,
      ageRestriction: row.ageRestriction,
      statistics: {
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        engagementRate: row.engagementRate,
      },
    }));

    const totalPages = Math.ceil(total / limit);
    const limitType = limit <= 15 ? LimitType.FIFTEEN : 
                     limit <= 30 ? LimitType.THIRTY : 
                     limit <= 50 ? LimitType.FIFTY : LimitType.HUNDRED;
    
    const pageInfo = {
      page,
      limit: limitType,
      totalItems: total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return { items, pageInfo };
  }

  // 기본 변경/조회 메서드들은 BaseRepository 직접 사용 (saveEntity, delete, exists, count 등)

  async getTrendingContent(hours: number = 24, limit: number = 50): Promise<ContentEntity[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    return this.createQueryBuilder('content')
      .where('content.publishedAt >= :startTime', { startTime })
      .orderBy('content.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getRecentContent(creatorIds: string[], limit: number = 20): Promise<ContentEntity[]> {
    if (creatorIds.length === 0) return [];

    return this.find({
      where: { creatorId: In(creatorIds) },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  async getTotalCount(): Promise<number> {
    return this.count();
  }

  // ==================== 고급 검색 및 필터링 메서드 ====================

  async findByCreatorIds(creatorIds: string[], limit = 50): Promise<ContentEntity[]> {
    if (creatorIds.length === 0) return [];

    return await this.find({
      where: { creatorId: In(creatorIds) },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  async findByPlatformAndStatus(platform: PlatformType): Promise<ContentEntity[]> {
    return await this.find({
      where: { platform },
      order: { publishedAt: 'DESC' },
    });
  }

  async findExpiredContent(): Promise<ContentEntity[]> {
    // No expiration logic needed since expiresAt field was removed
    return [];
  }

  // ==================== 배치 처리 메서드 ====================

  async batchUpdateContent(
    contentIds: string[],
    updateData: Partial<ContentEntity>,
    transactionManager?: EntityManager
  ): Promise<void> {
    if (contentIds.length === 0) return;

    const finalUpdateData = {
      ...updateData,
      updatedAt: new Date(),
    };

    const queryBuilder = transactionManager 
      ? transactionManager.createQueryBuilder()
      : this.createQueryBuilder();
      
    await queryBuilder
      .update(ContentEntity)
      .set(finalUpdateData)
      .where('id IN (:...contentIds)', { contentIds })
      .execute();
  }

  async batchUpdateContentById(
    updates: Array<{ id: string; updateData: Partial<ContentEntity> }>
  ): Promise<void> {
    if (updates.length === 0) return;

    for (const update of updates) {
      await this.createQueryBuilder()
        .update(ContentEntity)
        .set({
          ...update.updateData,
          updatedAt: new Date(),
        })
        .where('id = :id', { id: update.id })
        .execute();
    }
  }

  // ==================== 통계 및 집계 메서드 ====================

  async getContentStatsByCreator(creatorId: string): Promise<{
    totalContent: number;
    byPlatform: Array<{ platform: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  }> {
    const [totalContent, byPlatform, byType] = await Promise.all([
      this.count({ where: { creatorId } }),

      this.createQueryBuilder('content')
        .select('content.platform', 'platform')
        .addSelect('COUNT(*)', 'count')
        .where('content.creatorId = :creatorId', { creatorId })
        .groupBy('content.platform')
        .getRawMany(),

      this.createQueryBuilder('content')
        .select('content.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('content.creatorId = :creatorId', { creatorId })
        .groupBy('content.type')
        .getRawMany(),
    ]);

    return {
      totalContent,
      byPlatform: byPlatform.map((item) => ({
        platform: item.platform,
        count: parseInt(item.count),
      })),
      byType: byType.map((item) => ({
        type: item.type,
        count: parseInt(item.count),
      })),
    };
  }

  async getPlatformDistribution(): Promise<
    Array<{ platform: string; count: number; percentage: number }>
  > {
    const totalCount = await this.count();
    if (totalCount === 0) return [];

    const results = await this.createQueryBuilder('content')
      .select('content.platform', 'platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('content.platform')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((result) => ({
      platform: result.platform,
      count: parseInt(result.count),
      percentage: Math.round((parseInt(result.count) / totalCount) * 100 * 100) / 100,
    }));
  }

  async getContentGrowthStats(days = 30): Promise<Array<{ date: string; count: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.createQueryBuilder('content')
      .select('DATE(content.createdAt) as date')
      .addSelect('COUNT(*) as count')
      .where('content.createdAt >= :startDate', { startDate })
      .groupBy('DATE(content.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
  }

  // ==================== 콘텐츠 품질 관리 메서드 ====================

  async findLowQualityContent(criteria: {
    minDuration?: number;
    maxViews?: number;
    maxEngagement?: number;
  }): Promise<ContentEntity[]> {
    const queryBuilder = this.createQueryBuilder('content').leftJoin('content.statistics', 'stats');

    if (criteria.minDuration) {
      queryBuilder.andWhere('(content.duration IS NULL OR content.duration < :minDuration)', {
        minDuration: criteria.minDuration,
      });
    }

    if (criteria.maxViews) {
      queryBuilder.andWhere('(stats.views IS NULL OR stats.views < :maxViews)', {
        maxViews: criteria.maxViews,
      });
    }

    if (criteria.maxEngagement) {
      queryBuilder.andWhere(
        '(stats.engagementRate IS NULL OR stats.engagementRate < :maxEngagement)',
        {
          maxEngagement: criteria.maxEngagement,
        }
      );
    }

    return await queryBuilder.orderBy('content.createdAt', 'DESC').getMany();
  }

  async findDuplicateContent(platformId: string, platform: PlatformType): Promise<ContentEntity[]> {
    return await this.find({
      where: { platformId, platform },
      order: { createdAt: 'ASC' },
    });
  }
}
