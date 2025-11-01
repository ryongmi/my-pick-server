import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { UserInteractionEntity } from '../entities/user-interaction.entity.js';

@Injectable()
export class UserInteractionService {
  private readonly logger = new Logger(UserInteractionService.name);

  constructor(
    @InjectRepository(UserInteractionEntity)
    private readonly repo: Repository<UserInteractionEntity>
  ) {}

  // ==================== BOOKMARK METHODS ====================

  /**
   * 북마크 추가
   */
  async bookmarkContent(userId: string, contentId: string): Promise<void> {
    await this.upsertInteraction(userId, contentId, { isBookmarked: true });

    this.logger.log('Content bookmarked', {
      userId,
      contentId,
    });
  }

  /**
   * 북마크 제거
   */
  async removeBookmark(userId: string, contentId: string): Promise<void> {
    await this.upsertInteraction(userId, contentId, { isBookmarked: false });

    this.logger.log('Bookmark removed', {
      userId,
      contentId,
    });
  }

  /**
   * 북마크된 콘텐츠 ID 목록 조회
   */
  async getBookmarkedContentIds(userId: string): Promise<string[]> {
    const interactions = await this.repo.find({
      where: { userId, isBookmarked: true },
      select: ['contentId'],
    });

    this.logger.debug('Bookmarked content IDs fetched', {
      userId,
      count: interactions.length,
    });

    return interactions.map((i) => i.contentId);
  }

  /**
   * 북마크 여부 확인
   */
  async isBookmarked(userId: string, contentId: string): Promise<boolean> {
    const interaction = await this.repo.findOne({
      where: { userId, contentId },
      select: ['isBookmarked'],
    });

    return interaction?.isBookmarked || false;
  }

  // ==================== LIKE METHODS ====================

  /**
   * 좋아요 추가
   */
  async likeContent(userId: string, contentId: string): Promise<void> {
    await this.upsertInteraction(userId, contentId, { isLiked: true });

    this.logger.log('Content liked', {
      userId,
      contentId,
    });
  }

  /**
   * 좋아요 제거
   */
  async unlikeContent(userId: string, contentId: string): Promise<void> {
    await this.upsertInteraction(userId, contentId, { isLiked: false });

    this.logger.log('Like removed', {
      userId,
      contentId,
    });
  }

  /**
   * 좋아요한 콘텐츠 ID 목록 조회
   */
  async getLikedContentIds(userId: string): Promise<string[]> {
    const interactions = await this.repo.find({
      where: { userId, isLiked: true },
      select: ['contentId'],
    });

    this.logger.debug('Liked content IDs fetched', {
      userId,
      count: interactions.length,
    });

    return interactions.map((i) => i.contentId);
  }

  /**
   * 좋아요 여부 확인
   */
  async isLiked(userId: string, contentId: string): Promise<boolean> {
    const interaction = await this.repo.findOne({
      where: { userId, contentId },
      select: ['isLiked'],
    });

    return interaction?.isLiked || false;
  }

  /**
   * 콘텐츠의 좋아요 개수 조회
   */
  async getLikeCount(contentId: string): Promise<number> {
    const count = await this.repo.count({
      where: { contentId, isLiked: true },
    });

    return count;
  }

  // ==================== COMBINED METHODS ====================

  /**
   * 사용자의 여러 콘텐츠에 대한 상호작용 정보 조회
   */
  async getUserInteractions(
    userId: string,
    contentIds: string[]
  ): Promise<Map<string, UserInteractionEntity>> {
    if (contentIds.length === 0) {
      return new Map();
    }

    const interactions = await this.repo.find({
      where: { userId, contentId: In(contentIds) },
    });

    return new Map(interactions.map((i) => [i.contentId, i]));
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Interaction upsert (insert or update)
   */
  private async upsertInteraction(
    userId: string,
    contentId: string,
    updates: Partial<UserInteractionEntity>
  ): Promise<void> {
    await this.repo.upsert(
      {
        userId,
        contentId,
        ...updates,
      },
      ['userId', 'contentId']
    );
  }
}
