import { Injectable, Logger } from '@nestjs/common';

import { CreatorService } from '../../creator/services/creator.service.js';

import { UserSubscriptionRepository } from '../repositories/user-subscription.repository.js';
import { UserSubscriptionEntity } from '../entities/user-subscription.entity.js';
import { UserSubscriptionException } from '../exceptions/user-subscription.exception.js';

@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(
    private readonly userSubscriptionRepo: UserSubscriptionRepository,
    private readonly creatorService: CreatorService
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
    // 외래키 검증: Creator가 존재하는지 확인
    await this.creatorService.findByIdOrFail(creatorId);

    // 자기 자신 구독 방지 (만약 userId가 creatorId와 같다면)
    // Note: User와 Creator가 별도 엔티티이므로 일반적으로 발생하지 않음
    // 하지만 비즈니스 로직으로 체크 가능

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
    await this.userSubscriptionRepo.update(
      { userId, creatorId },
      { notificationEnabled }
    );

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
