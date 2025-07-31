import { Injectable, Logger, HttpException } from '@nestjs/common';

import { UserSubscriptionRepository } from '../repositories/index.js';
import { UserSubscriptionEntity } from '../entities/index.js';
import { SubscribeCreatorDto } from '../dto/index.js';
import { UserSubscriptionException } from '../exceptions/index.js';

@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(private readonly userSubscriptionRepo: UserSubscriptionRepository) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================

  async getCreatorIds(userId: string): Promise<string[]> {
    try {
      return await this.userSubscriptionRepo.getCreatorIds(userId);
    } catch (error: unknown) {
      this.logger.error('Get creator IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  async getUserIds(creatorId: string): Promise<string[]> {
    try {
      return await this.userSubscriptionRepo.getUserIds(creatorId);
    } catch (error: unknown) {
      this.logger.error('Get user IDs failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  async exists(userId: string, creatorId: string): Promise<boolean> {
    try {
      return await this.userSubscriptionRepo.exists({ userId, creatorId });
    } catch (error: unknown) {
      this.logger.error('Check subscription existence failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  // 배치 조회 메서드
  async getCreatorIdsBatch(userIds: string[]): Promise<Record<string, string[]>> {
    try {
      return await this.userSubscriptionRepo.getCreatorIdsBatch(userIds);
    } catch (error: unknown) {
      this.logger.error('Get creator IDs batch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userCount: userIds.length,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async subscribeToCreator(dto: SubscribeCreatorDto): Promise<void> {
    try {
      // 1. 중복 구독 확인
      const exists = await this.userSubscriptionRepo.exists({ userId: dto.userId, creatorId: dto.creatorId });
      if (exists) {
        this.logger.warn('Subscription already exists', {
          userId: dto.userId,
          creatorId: dto.creatorId,
        });
        throw UserSubscriptionException.subscriptionAlreadyExists();
      }

      // 2. 구독 생성
      const subscription = new UserSubscriptionEntity();
      Object.assign(subscription, {
        userId: dto.userId,
        creatorId: dto.creatorId,
        notificationEnabled: dto.notificationEnabled ?? true,
      });

      await this.userSubscriptionRepo.save(subscription);

      // 3. 성공 로깅
      this.logger.log('User subscribed to creator successfully', {
        userId: dto.userId,
        creatorId: dto.creatorId,
        notificationEnabled: subscription.notificationEnabled,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Subscription creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        creatorId: dto.creatorId,
      });

      throw UserSubscriptionException.subscriptionCreateError();
    }
  }

  async unsubscribeFromCreator(userId: string, creatorId: string): Promise<void> {
    try {
      // 1. 구독 존재 확인
      const exists = await this.userSubscriptionRepo.exists({ userId, creatorId });
      if (!exists) {
        this.logger.warn('Subscription not found for unsubscribe', {
          userId,
          creatorId,
        });
        throw UserSubscriptionException.subscriptionNotFound();
      }

      // 2. 구독 삭제
      await this.userSubscriptionRepo.delete({ userId, creatorId });

      // 3. 성공 로깅
      this.logger.log('User unsubscribed from creator successfully', {
        userId,
        creatorId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Unsubscription failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        creatorId,
      });

      throw UserSubscriptionException.subscriptionDeleteError();
    }
  }

  // ==================== 최적화 메서드 (필수) ====================

  async hasUsersForCreator(creatorId: string): Promise<boolean> {
    try {
      return await this.userSubscriptionRepo.hasUsersForCreator(creatorId);
    } catch (error: unknown) {
      this.logger.error('Check users for creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  // ==================== 통계 메서드 ====================

  async getSubscriberCount(creatorId: string): Promise<number> {
    try {
      return await this.userSubscriptionRepo.countByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Get subscriber count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  async getSubscriptionCount(userId: string): Promise<number> {
    try {
      return await this.userSubscriptionRepo.countByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get subscription count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  // 배치 통계 메서드
  async getSubscriberCountsByCreatorIds(creatorIds: string[]): Promise<Record<string, number>> {
    try {
      if (creatorIds.length === 0) return {};

      const subscriberCounts: Record<string, number> = {};

      // 배치로 각 크리에이터별 구독자 수 조회
      await Promise.all(
        creatorIds.map(async (creatorId) => {
          const count = await this.userSubscriptionRepo.countByCreatorId(creatorId);
          subscriberCounts[creatorId] = count;
        })
      );

      return subscriberCounts;
    } catch (error: unknown) {
      this.logger.error('Get subscriber counts batch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creatorIds.length,
      });
      // 에러가 발생해도 빈 객체 반환하여 다른 데이터 조회는 계속 진행
      return {};
    }
  }

  // ==================== 상세 조회 메서드 ====================

  async getSubscriptionDetail(
    userId: string,
    creatorId: string
  ): Promise<UserSubscriptionEntity | null> {
    try {
      return await this.userSubscriptionRepo.findByUserAndCreator(userId, creatorId);
    } catch (error: unknown) {
      this.logger.error('Get subscription detail failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  async getSubscriptionsByUserId(userId: string): Promise<UserSubscriptionEntity[]> {
    try {
      return await this.userSubscriptionRepo.findByUserId(userId);
    } catch (error: unknown) {
      this.logger.error('Get subscriptions by user ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  async getSubscriptionsByCreatorId(creatorId: string): Promise<UserSubscriptionEntity[]> {
    try {
      return await this.userSubscriptionRepo.findByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.error('Get subscriptions by creator ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw UserSubscriptionException.subscriptionFetchError();
    }
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.userSubscriptionRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.error('Failed to get total subscription count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}
