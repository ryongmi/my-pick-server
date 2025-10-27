import { Injectable, Logger } from '@nestjs/common';

import { ContentTagRepository, type TagStats, type PopularTag } from '../repositories/index.js';
import { ContentTagEntity } from '../entities/index.js';
import { ContentException } from '../exceptions/index.js';

@Injectable()
export class ContentTagService {
  private readonly logger = new Logger(ContentTagService.name);

  constructor(private readonly tagRepo: ContentTagRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByContentId(contentId: string): Promise<ContentTagEntity[]> {
    return await this.tagRepo.findByContentId(contentId);
  }

  async findByTag(tag: string): Promise<ContentTagEntity[]> {
    return await this.tagRepo.findByTag(tag);
  }

  async getHighRelevanceTags(contentId: string, minScore = 0.7): Promise<ContentTagEntity[]> {
    return await this.tagRepo.findHighRelevanceTags(contentId, minScore);
  }

  async getPopularTags(limit = 50): Promise<PopularTag[]> {
    try {
      return await this.tagRepo.getPopularTags(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get popular tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getTrendingTags(
    days = 7,
    limit = 20
  ): Promise<Array<{ tag: string; recentCount: number }>> {
    try {
      return await this.tagRepo.getTrendingTags(days, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get trending tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getSimilarTags(tag: string, limit = 10): Promise<string[]> {
    try {
      return await this.tagRepo.getSimilarTags(tag, limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get similar tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tag,
        limit,
      });
      return [];
    }
  }

  async searchTags(query: string, limit = 20): Promise<string[]> {
    if (!query.trim()) return [];

    try {
      return await this.tagRepo.searchTags(query.trim(), limit);
    } catch (error: unknown) {
      this.logger.error('Failed to search tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        limit,
      });
      return [];
    }
  }

  async getTagSuggestions(partialTag: string, limit = 10): Promise<string[]> {
    if (!partialTag.trim()) return [];

    try {
      return await this.tagRepo.getTagSuggestions(partialTag.trim(), limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get tag suggestions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        partialTag,
        limit,
      });
      return [];
    }
  }

  // ==================== 변경 메서드 ====================

  async assignTagsToContent(
    contentId: string,
    tags: Array<{
      tag: string;
      source?: 'platform' | 'ai' | 'manual';
      relevanceScore?: number;
      addedBy?: string;
    }>
  ): Promise<void> {
    if (tags.length === 0) return;

    try {
      // 기존 태그 제거
      await this.tagRepo.removeContentTags(contentId);

      // 태그 정규화 및 중복 제거
      const uniqueTags = Array.from(new Set(tags.map((t) => t.tag.toLowerCase().trim())))
        .filter((tag) => tag.length > 0)
        .map((tag) => {
          const originalTag = tags.find((t) => t.tag.toLowerCase().trim() === tag);
          const tagData: {
            contentId: string;
            tag: string;
            source: 'platform' | 'ai' | 'manual';
            relevanceScore: number;
            usageCount: number;
            addedBy?: string;
          } = {
            contentId,
            tag: originalTag?.tag || tag,
            source: originalTag?.source || ('platform' as const),
            relevanceScore: originalTag?.relevanceScore || 1.0,
            usageCount: 0,
          };

          if (originalTag?.addedBy !== undefined) {
            tagData.addedBy = originalTag.addedBy;
          }

          return tagData;
        });

      if (uniqueTags.length > 0) {
        await this.tagRepo.batchCreateTags(uniqueTags);

        // 태그 사용 횟수 증가
        const tagNames = uniqueTags.map((t) => t.tag);
        await this.tagRepo.incrementTagUsage(tagNames);

        this.logger.log('Tags assigned to content', {
          contentId,
          tagCount: uniqueTags.length,
          sources: Array.from(new Set(uniqueTags.map((t) => t.source))),
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to assign tags to content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        tagCount: tags.length,
      });
      throw ContentException.contentTagUpdateError();
    }
  }

  async updateRelevanceScores(
    updates: Array<{ contentId: string; tag: string; relevanceScore: number }>
  ): Promise<void> {
    if (updates.length === 0) return;

    // 점수 유효성 검증
    for (const update of updates) {
      if (update.relevanceScore < 0 || update.relevanceScore > 1) {
        throw ContentException.invalidContentData();
      }
    }

    try {
      await this.tagRepo.updateRelevanceScores(updates);

      this.logger.log('Tag relevance scores updated', {
        updateCount: updates.length,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update relevance scores', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updateCount: updates.length,
      });
      throw ContentException.contentTagUpdateError();
    }
  }

  async removeContentTags(contentId: string): Promise<void> {
    try {
      await this.tagRepo.removeContentTags(contentId);

      this.logger.log('Content tags removed', {
        contentId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to remove content tags', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentTagDeleteError();
    }
  }

  // ==================== 통계 및 분석 메서드 ====================

  async getTagStats(tag?: string): Promise<TagStats[]> {
    try {
      return await this.tagRepo.getTagStats(tag);
    } catch (error: unknown) {
      this.logger.error('Failed to get tag stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tag,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getTagsBySource(source: 'platform' | 'ai' | 'manual'): Promise<ContentTagEntity[]> {
    try {
      return await this.tagRepo.getTagsBySource(source);
    } catch (error: unknown) {
      this.logger.error('Failed to get tags by source', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getContentsByTag(tag: string, limit = 50): Promise<string[]> {
    try {
      const tags = await this.tagRepo.findByTag(tag);
      return tags.slice(0, limit).map((t) => t.contentId);
    } catch (error: unknown) {
      this.logger.error('Failed to get contents by tag', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tag,
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async batchIncrementTagUsage(tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    try {
      await this.tagRepo.incrementTagUsage(tags);

      this.logger.debug('Batch tag usage incremented', {
        tagCount: tags.length,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to batch increment tag usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tagCount: tags.length,
      });
      // 사용 횟수 업데이트 실패는 중요하지 않으므로 예외를 던지지 않음
    }
  }

  async batchProcessTagRelevance(
    contentIds: string[],
    aiRelevanceModel?: (
      contentId: string,
      tags: string[]
    ) => Promise<Array<{ tag: string; score: number }>>
  ): Promise<void> {
    if (contentIds.length === 0 || !aiRelevanceModel) return;

    try {
      for (const contentId of contentIds) {
        const existingTags = await this.tagRepo.findByContentId(contentId);
        const tagNames = existingTags.map((t) => t.tag);

        if (tagNames.length > 0) {
          const relevanceScores = await aiRelevanceModel(contentId, tagNames);

          const updates = relevanceScores.map((score) => ({
            contentId,
            tag: score.tag,
            relevanceScore: score.score,
          }));

          await this.updateRelevanceScores(updates);
        }
      }

      this.logger.log('Batch tag relevance processing completed', {
        contentCount: contentIds.length,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to batch process tag relevance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      throw ContentException.contentTagUpdateError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}
