import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { UserSubscriptionRepository } from '../repositories/user-subscription.repository.js';
import { UserSubscriptionException } from '../exceptions/user-subscription.exception.js';
import { CreatorRepository } from '../../creator/repositories/creator.repository.js';

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
    return this.userSubscriptionRepo.isSubscribed(userId, creatorId);
  }

  /**
   * 크리에이터에 구독자가 있는지 확인 (최적화)
   */
  async hasSubscribers(creatorId: string): Promise<boolean> {
    return this.userSubscriptionRepo.hasSubscribers(creatorId);
  }

  // ==================== 구독 관리 ====================

  /**
   * 크리에이터 구독
   */
  async subscribeToCreator(
    userId: string,
    creatorId: string,
    notificationEnabled: boolean = true
  ): Promise<void> {
    // 크리에이터 존재 여부 확인
    const creator = await this.creatorRepository.findOne({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new NotFoundException('크리에이터를 찾을 수 없습니다.');
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
      notificationEnabled,
    });

    await this.userSubscriptionRepo.save(subscription);

    this.logger.log('User subscribed to creator', {
      userId,
      creatorId,
      notificationEnabled,
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
    return this.userSubscriptionRepo.getSubscriptionCount(creatorId);
  }

  /**
   * 사용자의 구독 수 조회
   */
  async getUserSubscriptionCount(userId: string): Promise<number> {
    return this.userSubscriptionRepo.getUserSubscriptionCount(userId);
  }
}
