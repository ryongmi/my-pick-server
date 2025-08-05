import { Injectable, Logger, HttpException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';

import { ContentMetadataRepository, ContentMetadataSearchOptions } from '../repositories/content-metadata.repository.js';
import { ContentMetadataEntity } from '../entities/content-metadata.entity.js';
import { ContentException } from '../exceptions/content.exception.js';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

@Injectable()
export class ContentMetadataService {
  private readonly logger = new Logger(ContentMetadataService.name);

  constructor(private readonly metadataRepo: ContentMetadataRepository) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByContentId(contentId: string): Promise<ContentMetadataEntity | null> {
    return this.metadataRepo.findOne({ where: { contentId } });
  }

  async findByContentIds(contentIds: string[]): Promise<ContentMetadataEntity[]> {
    if (contentIds.length === 0) return [];
    return this.metadataRepo.find({
      where: { contentId: In(contentIds) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByContentIdOrFail(contentId: string): Promise<ContentMetadataEntity> {
    const metadata = await this.findByContentId(contentId);
    if (!metadata) {
      this.logger.warn('Content metadata not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return metadata;
  }

  // 복합 조회 메서드들
  async searchMetadata(options: ContentMetadataSearchOptions): Promise<PaginatedResult<ContentMetadataEntity>> {
    try {
      return await this.metadataRepo.searchMetadata(options);
    } catch (error: unknown) {
      this.logger.error('Content metadata search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        searchOptions: options,
      });
      throw ContentException.contentFetchError();
    }
  }

  async findByCategory(category: string, limit?: number): Promise<ContentMetadataEntity[]> {
    try {
      return await this.metadataRepo.findByCategory(category, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get metadata by category', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async findByTags(
    tags: string[],
    searchMode: 'any' | 'all' = 'any',
    limit?: number
  ): Promise<ContentMetadataEntity[]> {
    try {
      return await this.metadataRepo.findByTags(tags, searchMode, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get metadata by tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tags,
        searchMode,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async findLiveContent(limit?: number): Promise<ContentMetadataEntity[]> {
    try {
      return await this.metadataRepo.findLiveContent(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get live content metadata', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async findByQuality(quality: 'sd' | 'hd' | '4k', limit?: number): Promise<ContentMetadataEntity[]> {
    try {
      return await this.metadataRepo.findByQuality(quality, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get metadata by quality', {
        error: error instanceof Error ? error.message : 'Unknown error',
        quality,
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createMetadata(
    contentId: string,
    options: {
      tags: string[];
      category: string;
      language: string;
      isLive?: boolean;
      quality?: 'sd' | 'hd' | '4k';
      ageRestriction?: boolean;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 메타데이터 레코드 확인
      const existing = await this.metadataRepo.findOne({ where: { contentId } });
      if (existing) {
        this.logger.warn('Metadata record already exists', { contentId });
        return; // 이미 존재하면 스킵
      }

      const metadata = new ContentMetadataEntity();
      metadata.contentId = contentId;
      metadata.tags = options.tags;
      metadata.category = options.category;
      metadata.language = options.language;
      metadata.isLive = options.isLive || false;
      metadata.quality = options.quality || 'hd';
      metadata.ageRestriction = options.ageRestriction || false;

      const repository = transactionManager
        ? transactionManager.getRepository(ContentMetadataEntity)
        : this.metadataRepo;

      await (transactionManager ? repository.save(metadata) : this.metadataRepo.saveEntity(metadata));

      this.logger.log('Content metadata created', {
        contentId,
        category: options.category,
        language: options.language,
        tagsCount: options.tags.length,
        isLive: options.isLive,
        quality: options.quality,
      });
    } catch (error: unknown) {
      this.logger.error('Content metadata creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentCreateError();
    }
  }

  async updateMetadata(
    contentId: string,
    options: {
      tags?: string[];
      category?: string;
      language?: string;
      isLive?: boolean;
      quality?: 'sd' | 'hd' | '4k';
      ageRestriction?: boolean;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const metadata = await this.findByContentIdOrFail(contentId);

      // 제공된 옵션만 업데이트
      if (options.tags !== undefined) metadata.tags = options.tags;
      if (options.category !== undefined) metadata.category = options.category;
      if (options.language !== undefined) metadata.language = options.language;
      if (options.isLive !== undefined) metadata.isLive = options.isLive;
      if (options.quality !== undefined) metadata.quality = options.quality;
      if (options.ageRestriction !== undefined) metadata.ageRestriction = options.ageRestriction;

      const repository = transactionManager
        ? transactionManager.getRepository(ContentMetadataEntity)
        : this.metadataRepo;

      await (transactionManager ? repository.save(metadata) : this.metadataRepo.saveEntity(metadata));

      this.logger.log('Content metadata updated', {
        contentId,
        updatedFields: Object.keys(options).filter(key => options[key as keyof typeof options] !== undefined),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content metadata update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async updateTags(contentId: string, tags: string[], transactionManager?: EntityManager): Promise<void> {
    try {
      const metadata = await this.findByContentIdOrFail(contentId);
      metadata.tags = tags;

      const repository = transactionManager
        ? transactionManager.getRepository(ContentMetadataEntity)
        : this.metadataRepo;

      await (transactionManager ? repository.save(metadata) : this.metadataRepo.saveEntity(metadata));

      this.logger.log('Content tags updated', {
        contentId,
        tagsCount: tags.length,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content tags update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async deleteMetadata(contentId: string): Promise<void> {
    try {
      const result = await this.metadataRepo.delete({ contentId });
      
      if (result.affected === 0) {
        this.logger.warn('No metadata record found to delete', { contentId });
        return;
      }

      this.logger.log('Content metadata deleted', {
        contentId,
        deletedCount: result.affected,
      });
    } catch (error: unknown) {
      this.logger.error('Content metadata deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  // ==================== 통계 및 분석 메서드 ====================

  async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
    try {
      return await this.metadataRepo.getCategoryStats();
    } catch (error: unknown) {
      this.logger.error('Failed to get category stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getLanguageStats(): Promise<Array<{ language: string; count: number }>> {
    try {
      return await this.metadataRepo.getLanguageStats();
    } catch (error: unknown) {
      this.logger.error('Failed to get language stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getQualityDistribution(): Promise<Array<{ quality: string; count: number }>> {
    try {
      return await this.metadataRepo.getQualityDistribution();
    } catch (error: unknown) {
      this.logger.error('Failed to get quality distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    try {
      return await this.metadataRepo.getPopularTags(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get popular tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getMetadataStats(): Promise<{
    totalMetadata: number;
    liveContentCount: number;
    ageRestrictedCount: number;
    categoriesCount: number;
    languagesCount: number;
  }> {
    try {
      return await this.metadataRepo.getMetadataStats();
    } catch (error: unknown) {
      this.logger.error('Failed to get metadata stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async batchCreateMetadata(
    metadataList: Array<{
      contentId: string;
      tags: string[];
      category: string;
      language: string;
      isLive?: boolean;
      quality?: 'sd' | 'hd' | '4k';
      ageRestriction?: boolean;
    }>
  ): Promise<void> {
    try {
      if (metadataList.length === 0) return;

      await this.metadataRepo.batchCreateMetadata(metadataList);

      this.logger.log('Batch metadata creation completed', {
        metadataCount: metadataList.length,
      });
    } catch (error: unknown) {
      this.logger.error('Batch metadata creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metadataCount: metadataList.length,
      });
      throw ContentException.contentCreateError();
    }
  }

  async batchUpdateTags(
    updates: Array<{ contentId: string; tags: string[] }>
  ): Promise<void> {
    try {
      if (updates.length === 0) return;

      await this.metadataRepo.batchUpdateTags(updates);

      this.logger.log('Batch tags update completed', {
        updateCount: updates.length,
      });
    } catch (error: unknown) {
      this.logger.error('Batch tags update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updateCount: updates.length,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async getMetadataBatch(contentIds: string[]): Promise<Record<string, ContentMetadataEntity>> {
    try {
      if (contentIds.length === 0) return {};

      const metadataList = await this.metadataRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<string, ContentMetadataEntity> = {};
      metadataList.forEach((metadata) => {
        result[metadata.contentId] = metadata;
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch metadata batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  // ==================== 유틸리티 메서드 ====================

  async hasMetadata(contentId: string): Promise<boolean> {
    try {
      return await this.metadataRepo.exists({ where: { contentId } });
    } catch (error: unknown) {
      this.logger.error('Failed to check metadata existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return false;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      return await this.metadataRepo.count();
    } catch (error: unknown) {
      this.logger.error('Failed to get total metadata count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateTags(tags: string[]): boolean {
    return tags.every(tag => tag.length > 0 && tag.length <= 50);
  }

  private validateCategory(category: string): boolean {
    return category.length > 0 && category.length <= 100;
  }

  private validateLanguage(language: string): boolean {
    return language.length > 0 && language.length <= 10;
  }
}