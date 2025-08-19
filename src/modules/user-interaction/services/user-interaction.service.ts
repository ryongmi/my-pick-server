import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CacheService } from '@database/redis/index.js';

import { UserInteractionRepository } from '../repositories/index.js';
import { UserInteractionEntity } from '../entities/index.js';
import {
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
} from '../dto/index.js';
import { UserInteractionException } from '../exceptions/index.js';

@Injectable()
export class UserInteractionService {
  private readonly logger = new Logger(UserInteractionService.name);

  constructor(
    private readonly userInteractionRepo: UserInteractionRepository,
    private readonly cacheService: CacheService
  ) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================

  async getContentIds(userId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getContentIds(userId),
      'Get content IDs',
      { userId }
    );
  }

  async getUserIds(contentId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getUserIds(contentId),
      'Get user IDs',
      { contentId }
    );
  }

  async getBookmarkedContentIds(userId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.getWithCache(
        () => this.cacheService.getUserBookmarks(userId),
        () => this.userInteractionRepo.getBookmarkedContentIds(userId),
        (data) => this.cacheService.setUserBookmarks(userId, data),
        'Bookmarked content IDs',
        { userId, count: 'dynamic' }
      ),
      'Get bookmarked content IDs',
      { userId }
    );
  }

  async getLikedContentIds(userId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.getWithCache(
        () => this.cacheService.getUserLikes(userId),
        () => this.userInteractionRepo.getLikedContentIds(userId),
        (data) => this.cacheService.setUserLikes(userId, data),
        'Liked content IDs',
        { userId, count: 'dynamic' }
      ),
      'Get liked content IDs',
      { userId }
    );
  }

  async exists(userId: string, contentId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.exists({ userId, contentId }),
      'Check interaction existence',
      { userId, contentId }
    );
  }

  async isBookmarked(userId: string, contentId: string): Promise<boolean> {
    try {
      // 1. 캐시된 북마크 목록에서 빠른 확인
      const cachedBookmarks = await this.cacheService.getUserBookmarks(userId);
      if (cachedBookmarks && Array.isArray(cachedBookmarks)) {
        const isBookmarked = cachedBookmarks.includes(contentId);
        this.logger.debug('Bookmark status served from cache', {
          userId,
          contentId,
          isBookmarked,
        });
        return isBookmarked;
      }

      // 2. 캐시 미스 시 DB에서 직접 확인
      return await this.userInteractionRepo.isBookmarked(userId, contentId);
    } catch (error: unknown) {
      this.logger.error('Check bookmark status failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async isLiked(userId: string, contentId: string): Promise<boolean> {
    try {
      // 1. 캐시된 좋아요 목록에서 빠른 확인
      const cachedLikes = await this.cacheService.getUserLikes(userId);
      if (cachedLikes && Array.isArray(cachedLikes)) {
        const isLiked = cachedLikes.includes(contentId);
        this.logger.debug('Like status served from cache', {
          userId,
          contentId,
          isLiked,
        });
        return isLiked;
      }

      // 2. 캐시 미스 시 DB에서 직접 확인
      return await this.userInteractionRepo.isLiked(userId, contentId);
    } catch (error: unknown) {
      this.logger.error('Check like status failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  // 배치 조회 메서드
  async getContentIdsBatch(userIds: string[]): Promise<Record<string, string[]>> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getContentIdsBatch(userIds),
      'Get content IDs batch',
      { userCount: userIds.length }
    );
  }

  // ==================== 변경 메서드 ====================

  async bookmarkContent(dto: BookmarkContentDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const interaction = await this.userInteractionRepo.upsertInteraction(
        dto.userId,
        dto.contentId,
        { isBookmarked: true },
        transactionManager
      );

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(dto.userId);

      this.logger.log('Content bookmarked successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        wasNew: !interaction.updatedAt || interaction.createdAt >= interaction.updatedAt,
      });
    } catch (error: unknown) {
      this.logger.error('Bookmark creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  async removeBookmark(userId: string, contentId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const interaction = await this.userInteractionRepo.findByUserAndContent(userId, contentId);

      if (!interaction || !interaction.isBookmarked) {
        this.logger.warn('Bookmark not found for removal', {
          userId,
          contentId,
        });
        throw UserInteractionException.interactionNotFound();
      }

      // 다른 상호작용이 있는지 확인
      if (interaction.isLiked || interaction.watchedAt || interaction.rating) {
        // 북마크만 해제
        interaction.isBookmarked = false;
        await this.userInteractionRepo.saveEntity(interaction, transactionManager);
      } else {
        // 다른 상호작용이 없으면 완전 삭제
        await this.userInteractionRepo.delete({ userId, contentId });
      }

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(userId);

      this.logger.log('Bookmark removed successfully', {
        userId,
        contentId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Bookmark removal failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });

      throw UserInteractionException.interactionDeleteError();
    }
  }

  async likeContent(dto: LikeContentDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const interaction = await this.userInteractionRepo.upsertInteraction(
        dto.userId,
        dto.contentId,
        { isLiked: true },
        transactionManager
      );

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(dto.userId);

      this.logger.log('Content liked successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        wasNew: !interaction.updatedAt || interaction.createdAt >= interaction.updatedAt,
      });
    } catch (error: unknown) {
      this.logger.error('Like creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  async removeLike(userId: string, contentId: string, transactionManager?: EntityManager): Promise<void> {
    try {
      const interaction = await this.userInteractionRepo.findByUserAndContent(userId, contentId);

      if (!interaction || !interaction.isLiked) {
        this.logger.warn('Like not found for removal', {
          userId,
          contentId,
        });
        throw UserInteractionException.interactionNotFound();
      }

      // 다른 상호작용이 있는지 확인
      if (interaction.isBookmarked || interaction.watchedAt || interaction.rating) {
        // 좋아요만 해제
        interaction.isLiked = false;
        await this.userInteractionRepo.saveEntity(interaction, transactionManager);
      } else {
        // 다른 상호작용이 없으면 완전 삭제
        await this.userInteractionRepo.delete({ userId, contentId });
      }

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(userId);

      this.logger.log('Like removed successfully', {
        userId,
        contentId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Like removal failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });

      throw UserInteractionException.interactionDeleteError();
    }
  }

  async watchContent(dto: WatchContentDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const watchUpdate = {
        watchedAt: new Date(),
        ...(dto.watchDuration !== undefined && { watchDuration: dto.watchDuration }),
      };

      const interaction = await this.userInteractionRepo.upsertInteraction(
        dto.userId,
        dto.contentId,
        watchUpdate,
        transactionManager
      );

      this.logger.log('Content watch recorded successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        watchDuration: dto.watchDuration,
        totalWatchDuration: interaction.watchDuration,
      });
    } catch (error: unknown) {
      this.logger.error('Watch record failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  async rateContent(dto: RateContentDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const interaction = await this.userInteractionRepo.upsertInteraction(
        dto.userId,
        dto.contentId,
        { rating: dto.rating },
        transactionManager
      );

      this.logger.log('Content rated successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        rating: dto.rating,
        previousRating: interaction.rating !== dto.rating ? 'updated' : 'same',
      });
    } catch (error: unknown) {
      this.logger.error('Rating failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
        rating: dto.rating,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  // ==================== 토글 메서드 (실시간 상호작용) ====================

  async toggleBookmark(userId: string, contentId: string, transactionManager?: EntityManager): Promise<{ isBookmarked: boolean }> {
    try {
      const currentInteraction = await this.userInteractionRepo.findByUserAndContent(
        userId,
        contentId
      );
      const currentState = currentInteraction?.isBookmarked || false;
      const newState = !currentState;

      await this.userInteractionRepo.upsertInteraction(userId, contentId, {
        isBookmarked: newState,
      }, transactionManager);

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(userId);

      this.logger.log('Bookmark toggled successfully', {
        userId,
        contentId,
        from: currentState,
        to: newState,
      });

      return { isBookmarked: newState };
    } catch (error: unknown) {
      this.logger.error('Bookmark toggle failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionCreateError();
    }
  }

  async toggleLike(userId: string, contentId: string, transactionManager?: EntityManager): Promise<{ isLiked: boolean }> {
    try {
      const currentInteraction = await this.userInteractionRepo.findByUserAndContent(
        userId,
        contentId
      );
      const currentState = currentInteraction?.isLiked || false;
      const newState = !currentState;

      await this.userInteractionRepo.upsertInteraction(userId, contentId, { isLiked: newState }, transactionManager);

      // 캐시 무효화 (배치 처리)
      await this.cacheService.invalidateUserInteractionCaches(userId);

      this.logger.log('Like toggled successfully', {
        userId,
        contentId,
        from: currentState,
        to: newState,
      });

      return { isLiked: newState };
    } catch (error: unknown) {
      this.logger.error('Like toggle failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionCreateError();
    }
  }

  // ==================== 배치 조회 메서드 ====================

  /**
   * 여러 사용자의 상호작용 데이터를 배치로 조회
   * 캐시 미스 시 모든 사용자의 데이터를 일괄 조회하여 캐싱
   */
  async getUserInteractionsBatch(
    userIds: string[]
  ): Promise<Record<string, { bookmarks: string[]; likes: string[] }>> {
    try {
      if (userIds.length === 0) return {};

      const result: Record<string, { bookmarks: string[]; likes: string[] }> = {};
      const uncachedUserIds: string[] = [];

      // 1. 캐시에서 기존 데이터 수집
      for (const userId of userIds) {
        const [cachedBookmarks, cachedLikes] = await Promise.all([
          this.cacheService.getUserBookmarks(userId),
          this.cacheService.getUserLikes(userId),
        ]);

        if (cachedBookmarks && cachedLikes) {
          result[userId] = {
            bookmarks: cachedBookmarks,
            likes: cachedLikes,
          };
        } else {
          uncachedUserIds.push(userId);
        }
      }

      // 2. 캐시되지 않은 데이터만 DB에서 배치 조회
      if (uncachedUserIds.length > 0) {
        const contentIdsBatch = await this.userInteractionRepo.getContentIdsBatch(uncachedUserIds);

        for (const userId of uncachedUserIds) {
          const _userContentIds = contentIdsBatch[userId] || [];
          
          // 각 사용자의 북마크와 좋아요 분리
          const [bookmarks, likes] = await Promise.all([
            this.userInteractionRepo.getBookmarkedContentIds(userId),
            this.userInteractionRepo.getLikedContentIds(userId),
          ]);

          result[userId] = { bookmarks, likes };

          // 배치 캐싱
          await Promise.all([
            this.cacheService.setUserBookmarks(userId, bookmarks),
            this.cacheService.setUserLikes(userId, likes),
          ]);
        }
      }

      this.logger.debug('User interactions batch fetched', {
        totalUsers: userIds.length,
        cachedUsers: userIds.length - uncachedUserIds.length,
        uncachedUsers: uncachedUserIds.length,
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Get user interactions batch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getContentInteractionsBatch(
    contentIds: string[],
    userId: string
  ): Promise<Record<string, UserInteractionEntity>> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getContentInteractionsBatch(contentIds, userId),
      'Get content interactions batch',
      { userId, contentCount: contentIds.length }
    );
  }

  // ==================== 배치 캐시 무효화 메서드 ====================

  /**
   * 여러 사용자의 캐시를 배치로 무효화
   * 대량 업데이트 시 개별 캐시 삭제보다 효율적
   */
  async invalidateUserCachesBatch(userIds: string[]): Promise<void> {
    try {
      if (userIds.length === 0) return;

      // 모든 사용자의 캐시를 병렬로 무효화
      const deleteTasks = userIds.flatMap(userId => [
        this.cacheService.deleteUserInteractionCache(userId),
        this.cacheService.deleteUserBookmarksCache(userId),
        this.cacheService.deleteUserLikesCache(userId),
      ]);

      await Promise.all(deleteTasks);

      this.logger.debug('User interaction caches invalidated in batch', {
        userCount: userIds.length,
        totalCacheKeys: deleteTasks.length,
      });
    } catch (error: unknown) {
      this.logger.warn('Batch cache invalidation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length,
      });
      // 캐시 오류는 전파하지 않음
    }
  }

  // ==================== 최적화 메서드 (필수) ====================

  async hasUsersForContent(contentId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.hasUsersForContent(contentId),
      'Check users for content',
      { contentId }
    );
  }

  // ==================== 통계 메서드 ====================

  async getBookmarkCount(contentId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.countBookmarksByContentId(contentId),
      'Get bookmark count',
      { contentId }
    );
  }

  async getLikeCount(contentId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.countLikesByContentId(contentId),
      'Get like count',
      { contentId }
    );
  }

  async getUserInteractionCount(userId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.countByUserId(userId),
      'Get user interaction count',
      { userId }
    );
  }

  async getUserBookmarkCount(userId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.countBookmarksByUserId(userId),
      'Get user bookmark count',
      { userId }
    );
  }

  async getUserLikeCount(userId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.countLikesByUserId(userId),
      'Get user like count',
      { userId }
    );
  }

  // ==================== 상세 조회 메서드 ====================

  async getInteractionDetail(
    userId: string,
    contentId: string
  ): Promise<UserInteractionEntity | null> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.findByUserAndContent(userId, contentId),
      'Get interaction detail',
      { userId, contentId }
    );
  }

  async getInteractionsByUserId(userId: string): Promise<UserInteractionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.findByUserId(userId),
      'Get interactions by user ID',
      { userId }
    );
  }

  async getInteractionsByContentId(contentId: string): Promise<UserInteractionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.findByContentId(contentId),
      'Get interactions by content ID',
      { contentId }
    );
  }

  async getWatchHistory(userId: string, limit: number = 50): Promise<UserInteractionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getWatchHistory(userId, limit),
      'Get watch history',
      { userId, limit }
    );
  }

  async getTopRatedContent(limit: number = 20): Promise<UserInteractionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getTopRatedContent(limit),
      'Get top rated content',
      { limit }
    );
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 공통 에러 처리 패턴
   * 중복되는 try-catch 로직 제거
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });
      
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      
      throw UserInteractionException.interactionFetchError();
    }
  }

  /**
   * 캐시 우선 조회 패턴
   * 캐시 히트 시 즐시 반환, 미스 시 DB 조회 후 캐싱
   */
  private async getWithCache<T>(
    cacheGetter: () => Promise<T | null>,
    dbGetter: () => Promise<T>,
    cacheSetter: (data: T) => Promise<void>,
    operationName: string,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    // 1. 캐시 조회 시도
    const cached = await cacheGetter();
    if (cached !== null && cached !== undefined) {
      this.logger.debug(`${operationName} served from cache`, context);
      return cached;
    }

    // 2. DB에서 조회
    const data = await dbGetter();

    // 3. 캐싱
    await cacheSetter(data);

    this.logger.debug(`${operationName} fetched and cached`, {
      ...context,
      dataSize: Array.isArray(data) ? data.length : 'single',
    });

    return data;
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userInteractionRepo.getTotalCount(),
      'Get total interaction count',
      {},
      0 // fallback value
    );
  }
}
