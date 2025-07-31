import { Injectable } from '@nestjs/common';

import { DataSource, In } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentEntity } from '../entities/index.js';
import { ContentType } from '../enums/index.js';

export interface ContentSearchOptions {
  creatorId?: string;
  creatorIds?: string[];
  type?: ContentType;
  platform?: string;
  category?: string;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: LimitType;
  sortBy?: 'publishedAt' | 'views' | 'likes' | 'createdAt';
  sortOrder?: SortOrderType;
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
        `${contentAlias}.metadata AS metadata`,
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

    if (category) {
      qb.andWhere(`${contentAlias}.metadata ->> 'category' = :category`, { category });
    }

    if (tags && tags.length > 0) {
      qb.andWhere(`${contentAlias}.metadata ->> 'tags' @> :tags`, {
        tags: JSON.stringify(tags),
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
      metadata: row.metadata,
      statistics: {
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        engagementRate: row.engagementRate,
      },
    }));

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
}
