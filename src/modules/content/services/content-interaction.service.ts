import { Injectable, Logger } from '@nestjs/common';

import { 
  ContentInteractionRepository, 
  type InteractionStats, 
  type UserEngagement, 
  type ContentPerformance 
} from '../repositories/index.js';
import { ContentInteractionEntity } from '../entities/index.js';
import { ContentException } from '../exceptions/index.js';

@Injectable()
export class ContentInteractionService {
  private readonly logger = new Logger(ContentInteractionService.name);

  constructor(private readonly interactionRepo: ContentInteractionRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByContentId(contentId: string): Promise<ContentInteractionEntity[]> {
    return await this.interactionRepo.findByContentId(contentId);
  }

  async findByUserId(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.interactionRepo.findByUserId(userId);
  }

  async findInteraction(contentId: string, userId: string): Promise<ContentInteractionEntity | null> {
    return await this.interactionRepo.findInteraction(contentId, userId);
  }

  async getUserBookmarks(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.interactionRepo.getUserBookmarks(userId);
  }

  async getUserLikes(userId: string): Promise<ContentInteractionEntity[]> {
    return await this.interactionRepo.getUserLikes(userId);
  }

  async getUserWatchHistory(userId: string, limit = 50): Promise<ContentInteractionEntity[]> {
    return await this.interactionRepo.getUserWatchHistory(userId, limit);
  }

  // ==================== 변경 메서드 ====================

  async recordView(
    contentId: string, 
    userId: string,
    metadata?: {
      watchDuration?: number;
      watchPercentage?: number;
      deviceType?: string;
      referrer?: string;
    }
  ): Promise<void> {
    try {
      const interaction: Partial<ContentInteractionEntity> = {
        contentId,
        userId,
        interactionType: 'view',
        watchedAt: new Date(),
        watchDuration: metadata?.watchDuration,
        watchPercentage: metadata?.watchPercentage,
        deviceType: metadata?.deviceType,
        referrer: metadata?.referrer,
        updatedAt: new Date(),
      };

      await this.interactionRepo.upsertInteraction(interaction);

      this.logger.debug('View recorded', {
        contentId,
        userId,
        watchDuration: metadata?.watchDuration,
        watchPercentage: metadata?.watchPercentage,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to record view', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentInteractionCreateError();
    }
  }

  async toggleBookmark(contentId: string, userId: string): Promise<{ isBookmarked: boolean }> {
    try {
      const existingInteraction = await this.findInteraction(contentId, userId);
      const newBookmarkState = !existingInteraction?.isBookmarked;

      const interaction: Partial<ContentInteractionEntity> = {
        contentId,
        userId,
        isBookmarked: newBookmarkState,
        updatedAt: new Date(),
      };

      await this.interactionRepo.upsertInteraction(interaction);

      this.logger.log('Bookmark toggled', {
        contentId,
        userId,
        isBookmarked: newBookmarkState,
      });

      return { isBookmarked: newBookmarkState };
    } catch (error: unknown) {
      this.logger.error('Failed to toggle bookmark', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentInteractionUpdateError();
    }
  }

  async toggleLike(contentId: string, userId: string): Promise<{ isLiked: boolean }> {
    try {
      const existingInteraction = await this.findInteraction(contentId, userId);
      const newLikeState = !existingInteraction?.isLiked;

      const interaction: Partial<ContentInteractionEntity> = {
        contentId,
        userId,
        isLiked: newLikeState,
        updatedAt: new Date(),
      };

      await this.interactionRepo.upsertInteraction(interaction);

      this.logger.log('Like toggled', {
        contentId,
        userId,
        isLiked: newLikeState,
      });

      return { isLiked: newLikeState };
    } catch (error: unknown) {
      this.logger.error('Failed to toggle like', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentInteractionUpdateError();
    }
  }

  async markAsShared(contentId: string, userId: string): Promise<void> {
    try {
      const interaction: Partial<ContentInteractionEntity> = {
        contentId,
        userId,
        isShared: true,
        updatedAt: new Date(),
      };

      await this.interactionRepo.upsertInteraction(interaction);

      this.logger.log('Content marked as shared', {
        contentId,
        userId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to mark content as shared', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
      });
      throw ContentException.contentInteractionUpdateError();
    }
  }

  async submitRating(
    contentId: string, 
    userId: string, 
    rating: number,
    comment?: string
  ): Promise<void> {
    if (rating < 1.0 || rating > 5.0) {
      throw ContentException.invalidContentData();
    }

    try {
      const interaction: Partial<ContentInteractionEntity> = {
        contentId,
        userId,
        rating,
        comment,
        updatedAt: new Date(),
      };

      await this.interactionRepo.upsertInteraction(interaction);

      this.logger.log('Rating submitted', {
        contentId,
        userId,
        rating,
        hasComment: !!comment,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to submit rating', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
        userId,
        rating,
      });
      throw ContentException.contentInteractionUpdateError();
    }
  }

  // ==================== 통계 및 분석 메서드 ====================

  async getContentPerformance(contentId: string): Promise<ContentPerformance | null> {
    try {
      return await this.interactionRepo.getContentPerformance(contentId);
    } catch (error: unknown) {
      this.logger.error('Failed to get content performance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getTopPerformingContent(limit = 20): Promise<ContentPerformance[]> {
    try {
      return await this.interactionRepo.getTopPerformingContent(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get top performing content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getUserEngagement(userId: string): Promise<UserEngagement | null> {
    try {
      return await this.interactionRepo.getUserEngagement(userId);
    } catch (error: unknown) {
      this.logger.error('Failed to get user engagement', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getMostEngagedUsers(limit = 50): Promise<UserEngagement[]> {
    try {
      return await this.interactionRepo.getMostEngagedUsers(limit);
    } catch (error: unknown) {
      this.logger.error('Failed to get most engaged users', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getOverallStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<InteractionStats> {
    try {
      return await this.interactionRepo.getOverallStats(startDate, endDate);
    } catch (error: unknown) {
      this.logger.error('Failed to get overall interaction stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasStartDate: !!startDate,
        hasEndDate: !!endDate,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  async getInteractionsByDevice(contentId?: string): Promise<Array<{ deviceType: string; count: number }>> {
    try {
      return await this.interactionRepo.getInteractionsByDevice(contentId);
    } catch (error: unknown) {
      this.logger.error('Failed to get interactions by device', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async batchRecordViews(
    views: Array<{
      contentId: string;
      userId: string;
      watchDuration?: number;
      watchPercentage?: number;
      deviceType?: string;
      referrer?: string;
    }>
  ): Promise<void> {
    if (views.length === 0) return;

    try {
      const interactions = views.map(view => ({
        ...view,
        interactionType: 'view' as const,
        watchedAt: new Date(),
        updatedAt: new Date(),
      }));

      await this.interactionRepo.batchUpdateInteractions(interactions);

      this.logger.log('Batch views recorded', {
        viewCount: views.length,
        uniqueContent: new Set(views.map(v => v.contentId)).size,
        uniqueUsers: new Set(views.map(v => v.userId)).size,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to batch record views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        viewCount: views.length,
      });
      throw ContentException.contentInteractionCreateError();
    }
  }

  async cleanupOldInteractions(daysToKeep = 365): Promise<number> {
    try {
      const deletedCount = await this.interactionRepo.cleanupOldInteractions(daysToKeep);

      this.logger.log('Old interactions cleaned up', {
        deletedCount,
        daysToKeep,
      });

      return deletedCount;
    } catch (error: unknown) {
      this.logger.error('Failed to cleanup old interactions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysToKeep,
      });
      throw ContentException.contentInteractionDeleteError();
    }
  }

  // ==================== 개인화 추천용 메서드 ====================

  async getUserInteractionPattern(userId: string): Promise<{
    preferredCategories: string[];
    averageWatchPercentage: number;
    mostActiveHours: number[];
    preferredPlatforms: string[];
  }> {
    try {
      const interactions = await this.findByUserId(userId);
      
      if (interactions.length === 0) {
        return {
          preferredCategories: [],
          averageWatchPercentage: 0,
          mostActiveHours: [],
          preferredPlatforms: [],
        };
      }

      // 시청 패턴 분석 로직
      const watchPercentages = interactions
        .filter(i => i.watchPercentage !== null && i.watchPercentage !== undefined)
        .map(i => i.watchPercentage!);
      
      const averageWatchPercentage = watchPercentages.length > 0
        ? watchPercentages.reduce((sum, p) => sum + p, 0) / watchPercentages.length
        : 0;

      // 활동 시간대 분석
      const hours = interactions.map(i => new Date(i.updatedAt).getHours());
      const hourCounts = hours.reduce((acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const mostActiveHours = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

      return {
        preferredCategories: [], // 향후 카테고리 데이터와 연결
        averageWatchPercentage,
        mostActiveHours,
        preferredPlatforms: [], // 향후 콘텐츠 데이터와 연결
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get user interaction pattern', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw ContentException.contentStatisticsFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  // 향후 ML 기반 추천 알고리즘을 위한 메서드 예약
}