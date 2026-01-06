import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { In } from 'typeorm';

import { UserSubscriptionRepository } from '../repositories/user-subscription.repository.js';
import { UserSubscriptionException } from '../exceptions/user-subscription.exception.js';
import { CreatorRepository } from '../../creator/repositories/creator.repository.js';
import { UserSubscriptionEntity } from '../entities/user-subscription.entity.js';

@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(
    private readonly userSubscriptionRepo: UserSubscriptionRepository,
    private readonly creatorRepository: CreatorRepository
  ) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================

  /**
   * 사용자가 구독한 크리에이터 ID 목록 조회
   */
  async getCreatorIds(userId: string): Promise<string[]> {
    const creatorIds = await this.userSubscriptionRepo.getCreatorIds(userId);

    this.logger.debug('User creator subscriptions fetched from DB', {
      userId,
      count: creatorIds.length,
    });

    return creatorIds;
  }

  /**
   * 크리에이터를 구독하는 사용자 ID 목록 조회
   */
  async getUserIds(creatorId: string): Promise<string[]> {
    const userIds = await this.userSubscriptionRepo.getUserIds(creatorId);

    this.logger.debug('Creator subscribers fetched from DB', {
      creatorId,
      count: userIds.length,
    });

    return userIds;
  }

  /**
   * 알림 활성화된 구독 크리에이터 ID 목록 조회
   */
  async getNotificationEnabledCreatorIds(userId: string): Promise<string[]> {
    return this.userSubscriptionRepo.getNotificationEnabledCreatorIds(userId);
  }

  // ==================== 구독 여부 확인 ====================

  /**
   * 구독 여부 확인
   */
  async isSubscribed(userId: string, creatorId: string): Promise<boolean> {
    const count = await this.userSubscriptionRepo.count({
      where: { userId, creatorId },
    });

    return count > 0;
  }

  /**
   * 크리에이터에 구독자가 있는지 확인 (최적화)
   */
  async hasSubscribers(creatorId: string): Promise<boolean> {
    const count = await this.userSubscriptionRepo.count({
      where: { creatorId },
      take: 1, // 1개만 확인하면 충분
    });

    return count > 0;
  }

  // ==================== 구독 관리 ====================

  /**
   * 크리에이터 구독
   */
  async subscribeToCreator(userId: string, creatorId: string): Promise<void> {
    // 크리에이터 존재 여부 확인
    const creator = await this.creatorRepository.findOne({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new NotFoundException('크리에이터를 찾을 수 없습니다.');
    }

    if (userId === creator.userId) {
      throw UserSubscriptionException.cannotSubscribeSelf();
    }

    // 중복 구독 체크
    const alreadySubscribed = await this.isSubscribed(userId, creatorId);
    if (alreadySubscribed) {
      throw UserSubscriptionException.alreadySubscribed();
    }

    // 구독 생성
    const subscription = this.userSubscriptionRepo.create({
      userId,
      creatorId,
    });

    await this.userSubscriptionRepo.save(subscription);

    this.logger.log('User subscribed to creator', {
      userId,
      creatorId,
    });
  }

  /**
   * 크리에이터 구독 취소
   */
  async unsubscribeFromCreator(userId: string, creatorId: string): Promise<void> {
    // 구독 여부 확인
    const isSubscribed = await this.isSubscribed(userId, creatorId);
    if (!isSubscribed) {
      throw UserSubscriptionException.notSubscribed();
    }

    // 구독 삭제
    await this.userSubscriptionRepo.delete({
      userId,
      creatorId,
    });

    this.logger.log('User unsubscribed from creator', {
      userId,
      creatorId,
    });
  }

  /**
   * 알림 설정 업데이트
   */
  async updateNotificationSetting(
    userId: string,
    creatorId: string,
    notificationEnabled: boolean
  ): Promise<void> {
    // 구독 여부 확인
    const isSubscribed = await this.isSubscribed(userId, creatorId);
    if (!isSubscribed) {
      throw UserSubscriptionException.notSubscribed();
    }

    // 알림 설정 업데이트
    await this.userSubscriptionRepo.update({ userId, creatorId }, { notificationEnabled });

    this.logger.log('Notification setting updated', {
      userId,
      creatorId,
      notificationEnabled,
    });
  }

  // ==================== 통계 ====================

  /**
   * 크리에이터의 구독자 수 조회
   */
  async getSubscriptionCount(creatorId: string): Promise<number> {
    return await this.userSubscriptionRepo.count({
      where: { creatorId },
    });
  }

  /**
   * 사용자의 구독 수 조회
   */
  async getUserSubscriptionCount(userId: string): Promise<number> {
    return await this.userSubscriptionRepo.count({
      where: { userId },
    });
  }

  // ==================== 계정 병합 메서드 ====================

  /**
   * 사용자 구독 병합 (계정 병합용)
   * sourceUserId의 모든 구독을 targetUserId로 이전 (UPDATE 방식)
   */
  async mergeUserSubscriptions(sourceUserId: string, targetUserId: string): Promise<void> {
    try {
      this.logger.log('Starting user subscription merge', {
        sourceUserId,
        targetUserId,
      });

      // 1. source 사용자의 구독 크리에이터 조회
      const sourceCreatorIds = await this.getCreatorIds(sourceUserId);

      if (sourceCreatorIds.length === 0) {
        this.logger.warn('Source user has no subscriptions to merge', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      // 2. target 사용자의 기존 구독 조회
      const targetCreatorIds = await this.getCreatorIds(targetUserId);

      // 3. 중복되지 않은 구독 (target으로 이전할 것)
      const uniqueCreatorIds = sourceCreatorIds.filter(
        (creatorId) => !targetCreatorIds.includes(creatorId)
      );

      // 4. 중복되는 구독 (source에서 삭제할 것)
      const duplicateCreatorIds = sourceCreatorIds.filter((creatorId) =>
        targetCreatorIds.includes(creatorId)
      );

      await this.userSubscriptionRepo.manager.transaction(async (manager) => {
        // 5. 중복되지 않은 구독을 target 사용자로 UPDATE (소유권 이전)
        if (uniqueCreatorIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(UserSubscriptionEntity)
            .set({ userId: targetUserId })
            .where('userId = :sourceUserId', { sourceUserId })
            .andWhere('creatorId IN (:...uniqueCreatorIds)', { uniqueCreatorIds })
            .execute();
        }

        // 6. 중복되는 구독은 source에서 삭제
        if (duplicateCreatorIds.length > 0) {
          await manager.delete(UserSubscriptionEntity, {
            userId: sourceUserId,
            creatorId: In(duplicateCreatorIds),
          });
        }
      });

      this.logger.log('User subscriptions merged successfully', {
        sourceUserId,
        targetUserId,
        sourceSubscriptionCount: sourceCreatorIds.length,
        targetSubscriptionCount: targetCreatorIds.length,
        transferred: uniqueCreatorIds.length,
        duplicatesRemoved: duplicateCreatorIds.length,
      });
    } catch (error: unknown) {
      this.logger.error('User subscription merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }

  /**
   * 사용자 구독 병합 롤백 (보상 트랜잭션)
   * targetUserId로 병합된 구독을 다시 sourceUserId로 복원
   *
   * @param sourceUserId User B (원래 소유자)
   * @param targetUserId User A (병합 대상)
   * @param sourceCreatorIds User B가 원래 구독하고 있던 크리에이터 목록
   */
  async rollbackMerge(
    sourceUserId: string,
    targetUserId: string,
    sourceCreatorIds?: string[]
  ): Promise<void> {
    try {
      this.logger.log('Starting user subscription rollback', {
        sourceUserId,
        targetUserId,
        originalSubscriptionCount: sourceCreatorIds?.length || 0,
      });

      // sourceCreatorIds가 제공되지 않은 경우, 현재 target의 모든 구독을 되돌림 (안전 장치)
      let creatorIdsToRestore = sourceCreatorIds;

      if (!creatorIdsToRestore || creatorIdsToRestore.length === 0) {
        this.logger.warn('No sourceCreatorIds provided, skipping rollback', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      // 현재 target에 있는 구독 중 복원할 것들 필터링
      const currentTargetCreatorIds = await this.getCreatorIds(targetUserId);
      const creatorIdsToRestoreFiltered = creatorIdsToRestore.filter((id) =>
        currentTargetCreatorIds.includes(id)
      );

      if (creatorIdsToRestoreFiltered.length === 0) {
        this.logger.warn('No subscriptions to restore', {
          sourceUserId,
          targetUserId,
        });
        return;
      }

      await this.userSubscriptionRepo.manager.transaction(async (manager) => {
        // 1. target에서 해당 구독들을 source로 UPDATE (소유권 복원)
        await manager
          .createQueryBuilder()
          .update(UserSubscriptionEntity)
          .set({ userId: sourceUserId })
          .where('userId = :targetUserId', { targetUserId })
          .andWhere('creatorId IN (:...creatorIds)', { creatorIds: creatorIdsToRestoreFiltered })
          .execute();
      });

      this.logger.log('User subscriptions rollback completed successfully', {
        sourceUserId,
        targetUserId,
        restoredCount: creatorIdsToRestoreFiltered.length,
      });
    } catch (error: unknown) {
      this.logger.error('User subscription rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }
}
