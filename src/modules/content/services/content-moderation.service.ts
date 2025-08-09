import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import {
  ContentModerationRepository,
  ContentModerationSearchOptions,
} from '../repositories/content-moderation.repository.js';
import { ContentModerationEntity } from '../entities/content-moderation.entity.js';
import { ContentException } from '../exceptions/content.exception.js';

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);

  constructor(private readonly moderationRepo: ContentModerationRepository) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByContentId(contentId: string): Promise<ContentModerationEntity | null> {
    return this.moderationRepo.findOne({ where: { contentId } });
  }

  async findByContentIds(contentIds: string[]): Promise<ContentModerationEntity[]> {
    if (contentIds.length === 0) return [];
    return this.moderationRepo.find({
      where: { contentId: In(contentIds) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByContentIdOrFail(contentId: string): Promise<ContentModerationEntity> {
    const moderation = await this.findByContentId(contentId);
    if (!moderation) {
      this.logger.warn('Content moderation record not found', { contentId });
      throw ContentException.contentNotFound();
    }
    return moderation;
  }

  // 복합 조회 메서드들
  async searchModerations(
    options: ContentModerationSearchOptions
  ): Promise<PaginatedResult<ContentModerationEntity>> {
    try {
      return await this.moderationRepo.searchModerations(options);
    } catch (error: unknown) {
      this.logger.error('Content moderation search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        searchOptions: options,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getPendingModerations(): Promise<ContentModerationEntity[]> {
    try {
      return await this.moderationRepo.findPendingModeration();
    } catch (error: unknown) {
      this.logger.error('Failed to get pending moderations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ContentException.contentFetchError();
    }
  }

  async getFlaggedContent(limit?: number): Promise<ContentModerationEntity[]> {
    try {
      return await this.moderationRepo.findFlaggedContent(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get flagged content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createModerationRecord(
    contentId: string,
    options: {
      moderationStatus?: 'active' | 'inactive' | 'flagged' | 'removed';
    } = {},
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 모더레이션 레코드 확인
      const existing = await this.moderationRepo.findOne({ where: { contentId } });
      if (existing) {
        this.logger.warn('Moderation record already exists', { contentId });
        return; // 이미 존재하면 스킵
      }

      const moderation = new ContentModerationEntity();
      moderation.contentId = contentId;
      moderation.moderationStatus = options.moderationStatus || 'active';

      const repository = transactionManager
        ? transactionManager.getRepository(ContentModerationEntity)
        : this.moderationRepo;

      await (transactionManager
        ? repository.save(moderation)
        : this.moderationRepo.saveEntity(moderation));

      this.logger.log('Content moderation record created', {
        contentId,
        moderationStatus: moderation.moderationStatus,
      });
    } catch (error: unknown) {
      this.logger.error('Content moderation record creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentCreateError();
    }
  }

  async updateModerationStatus(
    contentId: string,
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    options: {
      moderatorId?: string;
      reason?: string;
    } = {},
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const moderation = await this.findByContentIdOrFail(contentId);

      moderation.moderationStatus = status;
      if (options.moderatorId) {
        moderation.moderatorId = options.moderatorId;
      }
      if (options.reason) {
        moderation.reason = options.reason;
      }
      moderation.moderatedAt = new Date();

      const repository = transactionManager
        ? transactionManager.getRepository(ContentModerationEntity)
        : this.moderationRepo;

      await (transactionManager
        ? repository.save(moderation)
        : this.moderationRepo.saveEntity(moderation));

      this.logger.log('Content moderation status updated', {
        contentId,
        status,
        moderatorId: options.moderatorId,
        hasReason: !!options.reason,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Content moderation status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        status,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async batchUpdateModerationStatus(
    contentIds: string[],
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    try {
      if (contentIds.length === 0) return;

      await this.moderationRepo.batchUpdateModerationStatus(
        contentIds,
        status,
        moderatorId,
        reason
      );

      this.logger.log('Batch moderation status update completed', {
        contentCount: contentIds.length,
        status,
        moderatorId,
        hasReason: !!reason,
      });
    } catch (error: unknown) {
      this.logger.error('Batch moderation status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
        status,
        moderatorId,
      });
      throw ContentException.contentUpdateError();
    }
  }

  async deleteModerationRecord(contentId: string): Promise<void> {
    try {
      const result = await this.moderationRepo.delete({ contentId });

      if (result.affected === 0) {
        this.logger.warn('No moderation record found to delete', { contentId });
        return;
      }

      this.logger.log('Content moderation record deleted', {
        contentId,
        deletedCount: result.affected,
      });
    } catch (error: unknown) {
      this.logger.error('Content moderation record deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentDeleteError();
    }
  }

  // ==================== 통계 및 분석 메서드 ====================

  async getModerationStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    active: number;
    inactive: number;
    flagged: number;
    removed: number;
    totalModerated: number;
  }> {
    try {
      return await this.moderationRepo.getModerationStats(startDate, endDate);
    } catch (error: unknown) {
      this.logger.error('Failed to get moderation stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
      });
      throw ContentException.contentFetchError();
    }
  }

  async getModeratorActivity(
    moderatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActions: number;
    flaggedCount: number;
    removedCount: number;
    restoredCount: number;
  }> {
    try {
      return await this.moderationRepo.getModeratorActivity(moderatorId, startDate, endDate);
    } catch (error: unknown) {
      this.logger.error('Failed to get moderator activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        moderatorId,
        startDate,
        endDate,
      });
      throw ContentException.contentFetchError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async getModerationBatch(contentIds: string[]): Promise<Record<string, ContentModerationEntity>> {
    try {
      if (contentIds.length === 0) return {};

      const moderations = await this.moderationRepo.find({
        where: { contentId: In(contentIds) },
      });

      const result: Record<string, ContentModerationEntity> = {};
      moderations.forEach((moderation) => {
        result[moderation.contentId] = moderation;
      });

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch moderation batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentCount: contentIds.length,
      });
      return {};
    }
  }

  // ==================== 유틸리티 메서드 ====================

  async hasModeration(contentId: string): Promise<boolean> {
    try {
      return await this.moderationRepo.exists({ contentId });
    } catch (error: unknown) {
      this.logger.error('Failed to check moderation existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return false;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      return await this.moderationRepo.count();
    } catch (error: unknown) {
      this.logger.error('Failed to get total moderation count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateModerationStatus(status: string): boolean {
    return ['active', 'inactive', 'flagged', 'removed'].includes(status);
  }
}
