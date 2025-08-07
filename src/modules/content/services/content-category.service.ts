import { Injectable, Logger } from '@nestjs/common';

import { ContentCategoryRepository, type CategoryStats } from '../repositories/index.js';
import { ContentCategoryEntity } from '../entities/index.js';
import { ContentException } from '../exceptions/index.js';

@Injectable()
export class ContentCategoryService {
  private readonly logger = new Logger(ContentCategoryService.name);

  constructor(private readonly categoryRepo: ContentCategoryRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByContentId(contentId: string): Promise<ContentCategoryEntity[]> {
    return await this.categoryRepo.findByContentId(contentId);
  }

  async findByCategory(category: string): Promise<ContentCategoryEntity[]> {
    return await this.categoryRepo.findByCategory(category);
  }

  async getPrimaryCategory(contentId: string): Promise<ContentCategoryEntity | null> {
    return await this.categoryRepo.getPrimaryCategory(contentId);
  }

  async getCategoryStats(category?: string): Promise<CategoryStats[]> {
    try {
      return await this.categoryRepo.getCategoryStats(category);
    } catch (error: unknown) {
      this.logger.error('Failed to get category stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getTopCategories(limit = 10): Promise<Array<{ category: string; contentCount: number }>> {
    try {
      return await this.categoryRepo.getTopCategories(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get top categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async assignCategoriesToContent(
    contentId: string,
    categories: Array<{
      category: string;
      isPrimary?: boolean;
      subcategory?: string;
      confidence?: number;
      source?: 'manual' | 'ai' | 'platform';
      classifiedBy?: string;
    }>
  ): Promise<void> {
    if (categories.length === 0) return;

    try {
      // 기존 카테고리 제거
      await this.categoryRepo.removeContentCategories(contentId);

      // 새 카테고리 배치 생성
      const categoryEntities = categories.map(cat => ({
        contentId,
        category: cat.category,
        isPrimary: cat.isPrimary || false,
        subcategory: cat.subcategory,
        confidence: cat.confidence || 1.0,
        source: cat.source || 'platform' as const,
        classifiedBy: cat.classifiedBy,
      }));

      await this.categoryRepo.batchCreateCategories(categoryEntities);

      this.logger.log('Categories assigned to content', {
        contentId,
        categoryCount: categories.length,
        primaryCount: categories.filter(c => c.isPrimary).length,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to assign categories to content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        categoryCount: categories.length,
      });
      throw ContentException.contentCategoryUpdateError();
    }
  }

  async updateCategoryConfidence(
    contentId: string,
    category: string,
    confidence: number
  ): Promise<void> {
    if (confidence < 0 || confidence > 1) {
      throw ContentException.invalidContentData();
    }

    try {
      await this.categoryRepo.updateCategoryConfidence(contentId, category, confidence);

      this.logger.log('Category confidence updated', {
        contentId,
        category,
        confidence,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update category confidence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        category,
        confidence,
      });
      throw ContentException.contentCategoryUpdateError();
    }
  }

  async removeContentCategories(contentId: string): Promise<void> {
    try {
      await this.categoryRepo.removeContentCategories(contentId);

      this.logger.log('Content categories removed', {
        contentId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to remove content categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentCategoryDeleteError();
    }
  }

  // ==================== AI 분류 관련 메서드 ====================

  async getAIClassifiedCategories(minConfidence = 0.8): Promise<ContentCategoryEntity[]> {
    try {
      return await this.categoryRepo.getAIClassifiedCategories(minConfidence);
    } catch (error: unknown) {
      this.logger.error('Failed to get AI classified categories', {
        error: error instanceof Error ? error.message : 'Unknown error',
        minConfidence,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async batchUpdateConfidenceScores(
    updates: Array<{ contentId: string; category: string; confidence: number }>
  ): Promise<void> {
    if (updates.length === 0) return;

    try {
      await this.categoryRepo.updateBatchConfidenceScores(updates);

      this.logger.log('Batch confidence scores updated', {
        updateCount: updates.length,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to batch update confidence scores', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updateCount: updates.length,
      });
      throw ContentException.contentCategoryUpdateError();
    }
  }

  // ==================== 통계 및 분석 메서드 ====================

  async getCategoryDistribution(): Promise<Array<{ category: string; count: number; percentage: number }>> {
    try {
      return await this.categoryRepo.getCategoryDistribution();
    } catch (error: unknown) {
      this.logger.error('Failed to get category distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getContentsByCategory(category: string, limit = 50): Promise<string[]> {
    try {
      const categories = await this.categoryRepo.findByCategory(category);
      return categories
        .slice(0, limit)
        .map(c => c.contentId);
    } catch (error: unknown) {
      this.logger.error('Failed to get contents by category', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  // 향후 AI 기반 카테고리 분류 로직을 위한 메서드 예약
}