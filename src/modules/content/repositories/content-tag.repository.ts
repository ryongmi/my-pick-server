import { Injectable } from '@nestjs/common';

import { DataSource, Repository, MoreThan } from 'typeorm';

import { ContentTagEntity } from '../entities/index.js';

export interface TagStats {
  tag: string;
  contentCount: number;
  avgRelevanceScore: number;
  sources: string[];
}

export interface PopularTag {
  tag: string;
  usageCount: number;
  recentUsage: number;
}

@Injectable()
export class ContentTagRepository extends Repository<ContentTagEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentTagEntity, dataSource.createEntityManager());
  }

  // ==================== 기본 조회 메서드 ====================

  async findByContentId(contentId: string): Promise<ContentTagEntity[]> {
    return await this.find({
      where: { contentId },
      order: { relevanceScore: 'DESC', createdAt: 'ASC' },
    });
  }

  async findByTag(tag: string): Promise<ContentTagEntity[]> {
    return await this.find({
      where: { tag },
      order: { relevanceScore: 'DESC', createdAt: 'DESC' },
    });
  }

  async findHighRelevanceTags(contentId: string, minScore = 0.7): Promise<ContentTagEntity[]> {
    return await this.find({
      where: {
        contentId,
        relevanceScore: MoreThan(minScore),
      },
      order: { relevanceScore: 'DESC' },
    });
  }

  // ==================== 인기 태그 및 추천 메서드 ====================

  async getPopularTags(limit = 50): Promise<PopularTag[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await this.createQueryBuilder('ct')
      .select('ct.tag', 'tag')
      .addSelect('ct.usageCount', 'usageCount')
      .addSelect('COUNT(CASE WHEN ct.createdAt > :thirtyDaysAgo THEN 1 END)', 'recentUsage')
      .where('ct.usageCount > 0')
      .setParameter('thirtyDaysAgo', thirtyDaysAgo)
      .groupBy('ct.tag, ct.usageCount')
      .orderBy('ct.usageCount', 'DESC')
      .addOrderBy('recentUsage', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getTrendingTags(days = 7, limit = 20): Promise<{ tag: string; recentCount: number }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.createQueryBuilder('ct')
      .select('ct.tag', 'tag')
      .addSelect('COUNT(*)', 'recentCount')
      .where('ct.createdAt > :cutoffDate', { cutoffDate })
      .groupBy('ct.tag')
      .orderBy('recentCount', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getSimilarTags(tag: string, limit = 10): Promise<string[]> {
    // 유사한 태그를 찾는 간단한 로직 (LIKE 검색)
    const results = await this.createQueryBuilder('ct')
      .select('DISTINCT ct.tag', 'tag')
      .where('ct.tag LIKE :pattern', { pattern: `%${tag}%` })
      .andWhere('ct.tag != :exactTag', { exactTag: tag })
      .orderBy('ct.usageCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => r.tag);
  }

  // ==================== 통계 및 집계 메서드 ====================

  async getTagStats(tag?: string): Promise<TagStats[]> {
    const queryBuilder = this.createQueryBuilder('ct');

    if (tag) {
      queryBuilder.where('ct.tag = :tag', { tag });
    }

    return await queryBuilder
      .select('ct.tag', 'tag')
      .addSelect('COUNT(DISTINCT ct.contentId)', 'contentCount')
      .addSelect('AVG(ct.relevanceScore)', 'avgRelevanceScore')
      .addSelect('JSON_ARRAYAGG(DISTINCT ct.source)', 'sources')
      .groupBy('ct.tag')
      .orderBy('contentCount', 'DESC')
      .getRawMany();
  }

  async getTagsBySource(source: 'platform' | 'ai' | 'manual'): Promise<ContentTagEntity[]> {
    return await this.find({
      where: { source },
      order: { usageCount: 'DESC', relevanceScore: 'DESC' },
    });
  }

  // ==================== 배치 처리 메서드 ====================

  async batchCreateTags(tags: Omit<ContentTagEntity, 'createdAt'>[]): Promise<void> {
    if (tags.length === 0) return;

    await this.createQueryBuilder()
      .insert()
      .into(ContentTagEntity)
      .values(tags)
      .orIgnore()
      .execute();
  }

  async removeContentTags(contentId: string): Promise<void> {
    await this.delete({ contentId });
  }

  async incrementTagUsage(tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    await this.createQueryBuilder()
      .update(ContentTagEntity)
      .set({
        usageCount: () => 'usageCount + 1',
      })
      .where('tag IN (:...tags)', { tags })
      .execute();
  }

  async updateRelevanceScores(
    updates: Array<{ contentId: string; tag: string; relevanceScore: number }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const queryBuilder = this.createQueryBuilder()
      .update(ContentTagEntity)
      .set({
        relevanceScore: () => 'VALUES(relevanceScore)',
      });

    for (const update of updates) {
      queryBuilder.orWhere('(contentId = :contentId AND tag = :tag)', update);
    }

    await queryBuilder.execute();
  }

  // ==================== 검색 관련 메서드 ====================

  async searchTags(query: string, limit = 20): Promise<string[]> {
    const results = await this.createQueryBuilder('ct')
      .select('DISTINCT ct.tag', 'tag')
      .where('ct.tag ILIKE :query', { query: `%${query}%` })
      .orderBy('ct.usageCount', 'DESC')
      .addOrderBy('ct.tag', 'ASC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => r.tag);
  }

  async getTagSuggestions(partialTag: string, limit = 10): Promise<string[]> {
    const results = await this.createQueryBuilder('ct')
      .select('DISTINCT ct.tag', 'tag')
      .where('ct.tag ILIKE :pattern', { pattern: `${partialTag}%` })
      .orderBy('ct.usageCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => r.tag);
  }
}
