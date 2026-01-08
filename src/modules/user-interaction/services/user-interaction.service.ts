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

  /**
   * 사용자의 모든 인터랙션 contentId 목록 조회
   * (계정 병합 스냅샷 수집용)
   */
  async getContentIds(userId: string): Promise<string[]> {
    const interactions = await this.repo.find({
      where: { userId },
      select: ['contentId'],
    });

    this.logger.debug('User interaction contentIds fetched', {
      userId,
      count: interactions.length,
    });

    return interactions.map((i) => i.contentId);
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

  // ==================== 계정 병합 메서드 ====================

  /**
   * 사용자 인터랙션 병합 (계정 병합용)
   * sourceUserId의 모든 인터랙션을 targetUserId로 이전 (UPDATE 방식)
   */
  async mergeUserInteractions(sourceUserId: string, targetUserId: string): Promise<void> {
    try {
      this.logger.log('Starting user interaction merge', {
        sourceUserId,
        targetUserId,
      });

      // 1. source 사용자의 모든 인터랙션 조회
      const sourceInteractions = await this.repo.find({
        where: { userId: sourceUserId },
      });

      if (sourceInteractions.length === 0) {
        this.logger.warn('Source user has no interactions to merge', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      // 2. target 사용자의 기존 인터랙션 조회
      const sourceContentIds = sourceInteractions.map((i) => i.contentId);
      const targetInteractions = await this.repo.find({
        where: {
          userId: targetUserId,
          contentId: In(sourceContentIds),
        },
      });

      const targetContentIdSet = new Set(targetInteractions.map((i) => i.contentId));

      // 3. 중복되지 않은 인터랙션 (target으로 이전할 것)
      const uniqueContentIds = sourceContentIds.filter(
        (contentId) => !targetContentIdSet.has(contentId)
      );

      // 4. 중복되는 인터랙션 (source에서 삭제할 것)
      const duplicateContentIds = sourceContentIds.filter((contentId) =>
        targetContentIdSet.has(contentId)
      );

      await this.repo.manager.transaction(async (manager) => {
        // 5. 중복되지 않은 인터랙션을 target 사용자로 UPDATE (소유권 이전)
        if (uniqueContentIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(UserInteractionEntity)
            .set({ userId: targetUserId })
            .where('userId = :sourceUserId', { sourceUserId })
            .andWhere('contentId IN (:...uniqueContentIds)', { uniqueContentIds })
            .execute();
        }

        // 6. 중복되는 인터랙션은 source에서 삭제
        if (duplicateContentIds.length > 0) {
          await manager.delete(UserInteractionEntity, {
            userId: sourceUserId,
            contentId: In(duplicateContentIds),
          });
        }
      });

      this.logger.log('User interactions merged successfully', {
        sourceUserId,
        targetUserId,
        sourceInteractionCount: sourceInteractions.length,
        targetInteractionCount: targetInteractions.length,
        transferred: uniqueContentIds.length,
        duplicatesRemoved: duplicateContentIds.length,
      });
    } catch (error: unknown) {
      this.logger.error('User interaction merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }

  /**
   * 사용자 인터랙션 병합 롤백 (보상 트랜잭션)
   * targetUserId로 병합된 인터랙션을 다시 sourceUserId로 복원
   *
   * @param sourceUserId User B (원래 소유자)
   * @param targetUserId User A (병합 대상)
   * @param sourceContentIds User B가 원래 인터랙션하고 있던 콘텐츠 목록
   */
  async rollbackMerge(
    sourceUserId: string,
    targetUserId: string,
    sourceContentIds?: string[]
  ): Promise<void> {
    try {
      this.logger.log('Starting user interaction rollback', {
        sourceUserId,
        targetUserId,
        originalInteractionCount: sourceContentIds?.length || 0,
      });

      // sourceContentIds가 제공되지 않은 경우, 롤백을 건너뜀
      if (!sourceContentIds || sourceContentIds.length === 0) {
        this.logger.warn('No sourceContentIds provided, skipping rollback', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      // 현재 target에 있는 인터랙션 중 복원할 것들 조회
      const currentTargetInteractions = await this.repo.find({
        where: {
          userId: targetUserId,
        },
        select: ['contentId'],
      });

      const currentTargetContentIds = currentTargetInteractions.map((i) => i.contentId);

      // 복원할 인터랙션 필터링 (원래 source에 있었고, 현재 target에 있는 것들)
      const contentIdsToRestore = sourceContentIds.filter((id) =>
        currentTargetContentIds.includes(id)
      );

      if (contentIdsToRestore.length === 0) {
        this.logger.warn('No interactions to restore', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      await this.repo.manager.transaction(async (manager) => {
        // target에서 해당 인터랙션들을 source로 UPDATE (소유권 복원)
        await manager
          .createQueryBuilder()
          .update(UserInteractionEntity)
          .set({ userId: sourceUserId })
          .where('userId = :targetUserId', { targetUserId })
          .andWhere('contentId IN (:...contentIds)', { contentIds: contentIdsToRestore })
          .execute();
      });

      this.logger.log('User interactions rollback completed successfully', {
        sourceUserId,
        targetUserId,
        restoredCount: contentIdsToRestore.length,
      });
    } catch (error: unknown) {
      this.logger.error('User interaction rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }
}
