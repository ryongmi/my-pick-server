import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { ContentCategoryEntity } from '../entities/index.js';

export interface CategoryStats {
  category: string;
  contentCount: number;
  subcategories: string[];
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

@Injectable()
export class ContentCategoryRepository extends Repository<ContentCategoryEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentCategoryEntity, dataSource.createEntityManager());
  }

  // ==================== 기본 조회 메서드 ====================

  async findByContentId(contentId: string): Promise<ContentCategoryEntity[]> {
    return await this.find({
      where: { contentId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async findByCategory(category: string): Promise<ContentCategoryEntity[]> {
    return await this.find({
      where: { category },
      order: { createdAt: 'DESC' },
    });
  }

  async getPrimaryCategory(contentId: string): Promise<ContentCategoryEntity | null> {
    return await this.findOne({
      where: { contentId, isPrimary: true },
    });
  }

  // ==================== 집계 및 통계 메서드 ====================

  async getCategoryStats(category?: string): Promise<CategoryStats[]> {
    const queryBuilder = this.createQueryBuilder('cc');

    if (category) {
      queryBuilder.where('cc.category = :category', { category });
    }

    return await queryBuilder
      .select('cc.category', 'category')
      .addSelect('COUNT(DISTINCT cc.contentId)', 'contentCount')
      .addSelect('JSON_ARRAYAGG(DISTINCT cc.subcategory)', 'subcategories')
      .groupBy('cc.category')
      .orderBy('contentCount', 'DESC')
      .getRawMany();
  }

  async getCategoryDistribution(): Promise<CategoryDistribution[]> {
    const totalCount = await this.count();
    if (totalCount === 0) return [];

    const results = await this.createQueryBuilder('cc')
      .select('cc.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('cc.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((result) => ({
      category: result.category,
      count: parseInt(result.count),
      percentage: Math.round((parseInt(result.count) / totalCount) * 100 * 100) / 100,
    }));
  }

  async getTopCategories(limit = 10): Promise<{ category: string; contentCount: number }[]> {
    return await this.createQueryBuilder('cc')
      .select('cc.category', 'category')
      .addSelect('COUNT(DISTINCT cc.contentId)', 'contentCount')
      .groupBy('cc.category')
      .orderBy('contentCount', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  // ==================== 배치 처리 메서드 ====================

  async batchCreateCategories(
    categories: Omit<ContentCategoryEntity, 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    if (categories.length === 0) return;

    await this.createQueryBuilder()
      .insert()
      .into(ContentCategoryEntity)
      .values(categories)
      .orIgnore()
      .execute();
  }

  async removeContentCategories(contentId: string): Promise<void> {
    await this.delete({ contentId });
  }

  async updateCategoryConfidence(
    contentId: string,
    category: string,
    confidence: number
  ): Promise<void> {
    await this.update({ contentId, category }, { confidence, updatedAt: new Date() });
  }

  // ==================== AI 분류 관련 메서드 ====================

  async getAIClassifiedCategories(minConfidence = 0.8): Promise<ContentCategoryEntity[]> {
    return await this.find({
      where: {
        source: 'ai',
      },
      order: { confidence: 'DESC' },
    });
  }

  async updateBatchConfidenceScores(
    updates: Array<{ contentId: string; category: string; confidence: number }>
  ): Promise<void> {
    if (updates.length === 0) return;

    const queryBuilder = this.createQueryBuilder()
      .update(ContentCategoryEntity)
      .set({
        confidence: () => 'VALUES(confidence)',
        updatedAt: new Date(),
      });

    for (const update of updates) {
      queryBuilder.orWhere('(contentId = :contentId AND category = :category)', update);
    }

    await queryBuilder.execute();
  }
}
