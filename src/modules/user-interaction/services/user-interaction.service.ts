import { Injectable, Logger, HttpException } from '@nestjs/common';

import { UserInteractionRepository } from '../repositories/index.js';
import { UserInteractionEntity } from '../entities/index.js';
import {
  BookmarkContentDto,
  LikeContentDto,
  WatchContentDto,
  RateContentDto,
  UpdateInteractionDto,
} from '../dto/index.js';
import { UserInteractionException } from '../exceptions/index.js';

@Injectable()
export class UserInteractionService {
  private readonly logger = new Logger(UserInteractionService.name);

  constructor(private readonly userInteractionRepo: UserInteractionRepository) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================

  async getContentIds(userId: string): Promise<string[]> {
    try {
      return await this.userInteractionRepo.getContentIds(userId);
    } catch (error: unknown) {
      this.logger.error('Get content IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getUserIds(contentId: string): Promise<string[]> {
    try {
      return await this.userInteractionRepo.getUserIds(contentId);
    } catch (error: unknown) {
      this.logger.error('Get user IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getBookmarkedContentIds(userId: string): Promise<string[]> {
    try {
      return await this.userInteractionRepo.getBookmarkedContentIds(userId);
    } catch (error: unknown) {
      this.logger.error('Get bookmarked content IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getLikedContentIds(userId: string): Promise<string[]> {
    try {
      return await this.userInteractionRepo.getLikedContentIds(userId);
    } catch (error: unknown) {
      this.logger.error('Get liked content IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async exists(userId: string, contentId: string): Promise<boolean> {
    try {
      return await this.userInteractionRepo.exists({ userId, contentId });
    } catch (error: unknown) {
      this.logger.error('Check interaction existence failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async isBookmarked(userId: string, contentId: string): Promise<boolean> {
    try {
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
    try {
      return await this.userInteractionRepo.getContentIdsBatch(userIds);
    } catch (error: unknown) {
      this.logger.error('Get content IDs batch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async bookmarkContent(dto: BookmarkContentDto): Promise<void> {
    try {
      // 1. 기존 상호작용 조회 또는 생성
      let interaction = await this.userInteractionRepo.findByUserAndContent(dto.userId, dto.contentId);

      if (!interaction) {
        interaction = new UserInteractionEntity();
        interaction.userId = dto.userId;
        interaction.contentId = dto.contentId;
      }

      // 2. 이미 북마크된 경우 확인
      if (interaction.isBookmarked) {
        this.logger.warn('Content already bookmarked', {
          userId: dto.userId,
          contentId: dto.contentId,
        });
        throw UserInteractionException.bookmarkAlreadyExists();
      }

      // 3. 북마크 설정
      interaction.isBookmarked = true;

      await this.userInteractionRepo.save(interaction);

      // 4. 성공 로깅
      this.logger.log('Content bookmarked successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Bookmark creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  async removeBookmark(userId: string, contentId: string): Promise<void> {
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
        await this.userInteractionRepo.save(interaction);
      } else {
        // 다른 상호작용이 없으면 완전 삭제
        await this.userInteractionRepo.delete({ userId, contentId });
      }

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

  async likeContent(dto: LikeContentDto): Promise<void> {
    try {
      // 1. 기존 상호작용 조회 또는 생성
      let interaction = await this.userInteractionRepo.findByUserAndContent(dto.userId, dto.contentId);

      if (!interaction) {
        interaction = new UserInteractionEntity();
        interaction.userId = dto.userId;
        interaction.contentId = dto.contentId;
      }

      // 2. 이미 좋아요한 경우 확인
      if (interaction.isLiked) {
        this.logger.warn('Content already liked', {
          userId: dto.userId,
          contentId: dto.contentId,
        });
        throw UserInteractionException.likeAlreadyExists();
      }

      // 3. 좋아요 설정
      interaction.isLiked = true;

      await this.userInteractionRepo.save(interaction);

      // 4. 성공 로깅
      this.logger.log('Content liked successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Like creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        contentId: dto.contentId,
      });

      throw UserInteractionException.interactionCreateError();
    }
  }

  async removeLike(userId: string, contentId: string): Promise<void> {
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
        await this.userInteractionRepo.save(interaction);
      } else {
        // 다른 상호작용이 없으면 완전 삭제
        await this.userInteractionRepo.delete({ userId, contentId });
      }

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

  async watchContent(dto: WatchContentDto): Promise<void> {
    try {
      // 1. 기존 상호작용 조회 또는 생성
      let interaction = await this.userInteractionRepo.findByUserAndContent(dto.userId, dto.contentId);

      if (!interaction) {
        interaction = new UserInteractionEntity();
        interaction.userId = dto.userId;
        interaction.contentId = dto.contentId;
      }

      // 2. 시청 정보 업데이트
      interaction.watchedAt = new Date();
      if (dto.watchDuration !== undefined) {
        interaction.watchDuration = dto.watchDuration;
      }

      await this.userInteractionRepo.save(interaction);

      // 3. 성공 로깅
      this.logger.log('Content watch recorded successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        watchDuration: dto.watchDuration,
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

  async rateContent(dto: RateContentDto): Promise<void> {
    try {
      // 1. 기존 상호작용 조회 또는 생성
      let interaction = await this.userInteractionRepo.findByUserAndContent(dto.userId, dto.contentId);

      if (!interaction) {
        interaction = new UserInteractionEntity();
        interaction.userId = dto.userId;
        interaction.contentId = dto.contentId;
      }

      // 2. 평점 설정
      interaction.rating = dto.rating;

      await this.userInteractionRepo.save(interaction);

      // 3. 성공 로깅
      this.logger.log('Content rated successfully', {
        userId: dto.userId,
        contentId: dto.contentId,
        rating: dto.rating,
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

  // ==================== 최적화 메서드 (필수) ====================

  async hasUsersForContent(contentId: string): Promise<boolean> {
    try {
      return await this.userInteractionRepo.hasUsersForContent(contentId);
    } catch (error: unknown) {
      this.logger.error('Check users for content failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  // ==================== 통계 메서드 ====================

  async getBookmarkCount(contentId: string): Promise<number> {
    try {
      return await this.userInteractionRepo.countBookmarksByContentId(contentId);
    } catch (error: unknown) {
      this.logger.error('Get bookmark count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getLikeCount(contentId: string): Promise<number> {
    try {
      return await this.userInteractionRepo.countLikesByContentId(contentId);
    } catch (error: unknown) {
      this.logger.error('Get like count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getUserInteractionCount(userId: string): Promise<number> {
    try {
      return await this.userInteractionRepo.countByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get user interaction count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getUserBookmarkCount(userId: string): Promise<number> {
    try {
      return await this.userInteractionRepo.countBookmarksByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get user bookmark count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getUserLikeCount(userId: string): Promise<number> {
    try {
      return await this.userInteractionRepo.countLikesByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get user like count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  // ==================== 상세 조회 메서드 ====================

  async getInteractionDetail(
    userId: string,
    contentId: string
  ): Promise<UserInteractionEntity | null> {
    try {
      return await this.userInteractionRepo.findByUserAndContent(userId, contentId);
    } catch (error: unknown) {
      this.logger.error('Get interaction detail failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getInteractionsByUserId(userId: string): Promise<UserInteractionEntity[]> {
    try {
      return await this.userInteractionRepo.findByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get interactions by user ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getInteractionsByContentId(contentId: string): Promise<UserInteractionEntity[]> {
    try {
      return await this.userInteractionRepo.findByContentId(contentId);
    } catch (error: unknown) {
      this.logger.error('Get interactions by content ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getWatchHistory(userId: string, limit: number = 50): Promise<UserInteractionEntity[]> {
    try {
      return await this.userInteractionRepo.getWatchHistory(userId, limit);
    } catch (error: unknown) {
      this.logger.error('Get watch history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        limit,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }

  async getTopRatedContent(limit: number = 20): Promise<UserInteractionEntity[]> {
    try {
      return await this.userInteractionRepo.getTopRatedContent(limit);
    } catch (error: unknown) {
      this.logger.error('Get top rated content failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw UserInteractionException.interactionFetchError();
    }
  }
}

