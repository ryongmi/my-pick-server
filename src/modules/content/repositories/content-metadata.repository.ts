import { Injectable } from '@nestjs/common';
import { DataSource, In, Like, ILike } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentMetadataEntity } from '../entities/content-metadata.entity.js';

export interface ContentMetadataSearchOptions {
  category?: string;
  language?: string;
  quality?: 'sd' | 'hd' | '4k';
  isLive?: boolean;
  ageRestriction?: boolean;
  tags?: string[];
  tagSearchMode?: 'any' | 'all'; // tags 검색 모드
  page?: number;
  limit?: LimitType;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: SortOrderType;
}

@Injectable()
export class ContentMetadataRepository extends BaseRepository<ContentMetadataEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentMetadataEntity, dataSource);
  }

  // ==================== 기본 조회는 서비스에서 BaseRepository 직접 사용 ====================

  // ==================== 복잡한 쿼리만 리포지토리에서 처리 ====================

  async searchMetadata(
    options: ContentMetadataSearchOptions
  ): Promise<PaginatedResult<ContentMetadataEntity>> {
    const {
      category,
      language,
      quality,
      isLive,
      ageRestriction,
      tags,
      tagSearchMode = 'any',
      page = 1,
      limit = LimitType.FIFTEEN,
      sortBy = 'createdAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const metadataAlias = 'metadata';

    const qb = this.createQueryBuilder(metadataAlias);

    if (category) {
      qb.andWhere(`${metadataAlias}.category = :category`, { category });
    }

    if (language) {
      qb.andWhere(`${metadataAlias}.language = :language`, { language });
    }

    if (quality) {
      qb.andWhere(`${metadataAlias}.quality = :quality`, { quality });
    }

    if (isLive !== undefined) {
      qb.andWhere(`${metadataAlias}.isLive = :isLive`, { isLive });
    }

    if (ageRestriction !== undefined) {
      qb.andWhere(`${metadataAlias}.ageRestriction = :ageRestriction`, { ageRestriction });
    }

    // 태그 검색 로직
    if (tags && tags.length > 0) {
      if (tagSearchMode === 'all') {
        // 모든 태그를 포함하는 콘텐츠 검색
        tags.forEach((tag, index) => {
          qb.andWhere(`FIND_IN_SET(:tag${index}, ${metadataAlias}.tags) > 0`, { [`tag${index}`]: tag });
        });
      } else {
        // 하나 이상의 태그를 포함하는 콘텐츠 검색
        const tagConditions = tags.map((_, index) => `FIND_IN_SET(:tag${index}, ${metadataAlias}.tags) > 0`);
        qb.andWhere(`(${tagConditions.join(' OR ')})`, 
          Object.fromEntries(tags.map((tag, index) => [`tag${index}`, tag]))
        );
      }
    }

    qb.orderBy(`${metadataAlias}.${sortBy}`, sortOrder);
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

  async findByCategory(category: string, limit?: number): Promise<ContentMetadataEntity[]> {
    const queryOptions: any = {
      where: { category },
      order: { createdAt: 'DESC' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    return this.find(queryOptions);
  }

  async findByTags(
    tags: string[],
    searchMode: 'any' | 'all' = 'any',
    limit?: number
  ): Promise<ContentMetadataEntity[]> {
    if (tags.length === 0) return [];

    const metadataAlias = 'metadata';
    const qb = this.createQueryBuilder(metadataAlias);

    if (searchMode === 'all') {
      // 모든 태그를 포함
      tags.forEach((tag, index) => {
        qb.andWhere(`FIND_IN_SET(:tag${index}, ${metadataAlias}.tags) > 0`, { [`tag${index}`]: tag });
      });
    } else {
      // 하나 이상의 태그를 포함
      const tagConditions = tags.map((_, index) => `FIND_IN_SET(:tag${index}, ${metadataAlias}.tags) > 0`);
      qb.andWhere(`(${tagConditions.join(' OR ')})`, 
        Object.fromEntries(tags.map((tag, index) => [`tag${index}`, tag]))
      );
    }

    qb.orderBy(`${metadataAlias}.createdAt`, 'DESC');

    if (limit) {
      qb.take(limit);
    }

    return qb.getMany();
  }

  async findLiveContent(limit?: number): Promise<ContentMetadataEntity[]> {
    const queryOptions: any = {
      where: { isLive: true },
      order: { createdAt: 'DESC' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    return this.find(queryOptions);
  }

  async findByQuality(quality: 'sd' | 'hd' | '4k', limit?: number): Promise<ContentMetadataEntity[]> {
    const queryOptions: any = {
      where: { quality },
      order: { createdAt: 'DESC' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    return this.find(queryOptions);
  }

  // ==================== 통계 메서드 ====================

  async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
    const result = await this.createQueryBuilder('metadata')
      .select('metadata.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('metadata.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => ({
      category: row.category,
      count: parseInt(row.count, 10),
    }));
  }

  async getLanguageStats(): Promise<Array<{ language: string; count: number }>> {
    const result = await this.createQueryBuilder('metadata')
      .select('metadata.language', 'language')
      .addSelect('COUNT(*)', 'count')
      .groupBy('metadata.language')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => ({
      language: row.language,
      count: parseInt(row.count, 10),
    }));
  }

  async getQualityDistribution(): Promise<Array<{ quality: string; count: number }>> {
    const result = await this.createQueryBuilder('metadata')
      .select('metadata.quality', 'quality')
      .addSelect('COUNT(*)', 'count')
      .groupBy('metadata.quality')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map(row => ({
      quality: row.quality,
      count: parseInt(row.count, 10),
    }));
  }

  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    // MySQL에서 FIND_IN_SET으로 태그 빈도 계산
    const result = await this.query(`
      SELECT 
        TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t.tags, ',', n.n), ',', -1)) as tag,
        COUNT(*) as count
      FROM content_metadata t
      CROSS JOIN (
        SELECT a.N + b.N * 10 + 1 n
        FROM 
        (SELECT 0 as N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
        (SELECT 0 as N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
        ORDER BY n
      ) n
      WHERE n.n <= 1 + (CHAR_LENGTH(t.tags) - CHAR_LENGTH(REPLACE(t.tags, ',', '')))
      AND LENGTH(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t.tags, ',', n.n), ',', -1))) > 0
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ?
    `, [limit]);

    return result.map((row: any) => ({
      tag: row.tag,
      count: parseInt(row.count, 10),
    }));
  }

  async getMetadataStats(): Promise<{
    totalMetadata: number;
    liveContentCount: number;
    ageRestrictedCount: number;
    categoriesCount: number;
    languagesCount: number;
  }> {
    const [totalMetadata, liveContentCount, ageRestrictedCount, categories, languages] = await Promise.all([
      this.count(),
      this.count({ where: { isLive: true } }),
      this.count({ where: { ageRestriction: true } }),
      this.createQueryBuilder('metadata')
        .select('COUNT(DISTINCT metadata.category)', 'count')
        .getRawOne(),
      this.createQueryBuilder('metadata')
        .select('COUNT(DISTINCT metadata.language)', 'count')
        .getRawOne(),
    ]);

    return {
      totalMetadata,
      liveContentCount,
      ageRestrictedCount,
      categoriesCount: parseInt(categories?.count || '0', 10),
      languagesCount: parseInt(languages?.count || '0', 10),
    };
  }

  // ==================== 배치 처리 메서드 ====================

  async batchCreateMetadata(metadataList: Array<{
    contentId: string;
    tags: string[];
    category: string;
    language: string;
    isLive?: boolean;
    quality?: 'sd' | 'hd' | '4k';
    ageRestriction?: boolean;
  }>): Promise<void> {
    if (metadataList.length === 0) return;

    const entities = metadataList.map(data => {
      const metadata = new ContentMetadataEntity();
      metadata.contentId = data.contentId;
      metadata.tags = data.tags;
      metadata.category = data.category;
      metadata.language = data.language;
      metadata.isLive = data.isLive || false;
      metadata.quality = data.quality || 'hd';
      metadata.ageRestriction = data.ageRestriction || false;
      return metadata;
    });

    await this.save(entities);
  }

  async batchUpdateTags(
    updates: Array<{ contentId: string; tags: string[] }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const promises = updates.map(({ contentId, tags }) =>
      this.update({ contentId }, { tags, updatedAt: new Date() })
    );

    await Promise.all(promises);
  }
}