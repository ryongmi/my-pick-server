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
   * 알림 활성화된 구독만 조회
   */
  async getNotificationEnabledCreatorIds(userId: string): Promise<string[]> {
    const subscriptions = await this.find({
      where: { userId, notificationEnabled: true },
      select: ['creatorId'],
    });

    return subscriptions.map((s) => s.creatorId);
  }
}
