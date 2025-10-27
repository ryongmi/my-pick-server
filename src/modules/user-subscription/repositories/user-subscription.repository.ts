import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { UserSubscriptionEntity } from '../entities/user-subscription.entity.js';

@Injectable()
export class UserSubscriptionRepository extends Repository<UserSubscriptionEntity> {
  constructor(private dataSource: DataSource) {
    super(UserSubscriptionEntity, dataSource.createEntityManager());
  }

  /**
   * 사용자가 구독한 크리에이터 ID 목록 조회
   */
  async getCreatorIds(userId: string): Promise<string[]> {
    const subscriptions = await this.find({
      where: { userId },
      select: ['creatorId'],
      order: { subscribedAt: 'DESC' },
    });

    return subscriptions.map((s) => s.creatorId);
  }

  /**
   * 크리에이터를 구독하는 사용자 ID 목록 조회
   */
  async getUserIds(creatorId: string): Promise<string[]> {
    const subscriptions = await this.find({
      where: { creatorId },
      select: ['userId'],
      order: { subscribedAt: 'DESC' },
    });

    return subscriptions.map((s) => s.userId);
  }

  /**
   * 구독 여부 확인
   */
  async isSubscribed(userId: string, creatorId: string): Promise<boolean> {
    const count = await this.count({
      where: { userId, creatorId },
    });

    return count > 0;
  }

  /**
   * 구독 수 조회
   */
  async getSubscriptionCount(creatorId: string): Promise<number> {
    return this.count({
      where: { creatorId },
    });
  }

  /**
   * 사용자의 구독 수 조회
   */
  async getUserSubscriptionCount(userId: string): Promise<number> {
    return this.count({
      where: { userId },
    });
  }

  /**
   * 알림 활성화된 구독만 조회
   */
  async getNotificationEnabledCreatorIds(userId: string): Promise<string[]> {
    const subscriptions = await this.find({
      where: { userId, notificationEnabled: true },
      select: ['creatorId'],
    });

    return subscriptions.map((s) => s.creatorId);
  }

  /**
   * 크리에이터에 구독자가 있는지 확인 (최적화)
   */
  async hasSubscribers(creatorId: string): Promise<boolean> {
    const count = await this.count({
      where: { creatorId },
      take: 1, // 1개만 확인하면 충분
    });

    return count > 0;
  }
}
