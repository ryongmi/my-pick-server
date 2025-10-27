import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CacheService } from '@database/redis/index.js';

import { UserSubscriptionRepository } from '../repositories/index.js';
import { UserSubscriptionEntity } from '../entities/index.js';
import { SubscribeCreatorDto } from '../dto/index.js';
import { UserSubscriptionException } from '../exceptions/index.js';

@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);

  constructor(
    private readonly userSubscriptionRepo: UserSubscriptionRepository,
    private readonly cacheService: CacheService
  ) {}

  // ==================== 조회 메서드 (ID 목록 반환) ====================

  async getCreatorIds(userId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.getWithCache(
        () => this.cacheService.getUserCreatorSubscriptions(userId),
        () => this.userSubscriptionRepo.getCreatorIds(userId),
        (data) => this.cacheService.setUserCreatorSubscriptions(userId, data),
        'User creator subscriptions',
        { userId, count: 'dynamic' }
      ),
      'Get creator IDs',
      { userId }
    );
  }

  async getUserIds(creatorId: string): Promise<string[]> {
    return this.executeWithErrorHandling(
      () => this.getWithCache(
        () => this.cacheService.getCreatorSubscribers(creatorId),
        () => this.userSubscriptionRepo.getUserIds(creatorId),
        (data) => this.cacheService.setCreatorSubscribers(creatorId, data),
        'Creator subscribers',
        { creatorId, count: 'dynamic' }
      ),
      'Get user IDs',
      { creatorId }
    );
  }

  async exists(userId: string, creatorId: string): Promise<boolean> {
    try {
      // 1. 캐시된 구독 목록에서 빠른 확인
      const cachedCreatorIds = await this.cacheService.getUserCreatorSubscriptions(userId);
      if (cachedCreatorIds && Array.isArray(cachedCreatorIds)) {
        const exists = cachedCreatorIds.includes(creatorId);
        this.logger.debug('Subscription existence served from cache', {
          userId,
          creatorId,
          exists,
        });
        return exists;
      }

      // 2. 캐시 미스 시 DB에서 직접 확인
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
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.getCreatorIdsBatch(userIds),
      'Get creator IDs batch',
      { userCount: userIds.length }
    );
  }

  // ==================== 변경 메서드 ====================

  async subscribeToCreator(dto: SubscribeCreatorDto, transactionManager?: EntityManager): Promise<void> {
    try {
      // 1. 중복 구독 확인
      const exists = await this.userSubscriptionRepo.exists({
        userId: dto.userId,
        creatorId: dto.creatorId,
      });
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

      await this.userSubscriptionRepo.saveEntity(subscription, transactionManager);

      // 3. 캐시 무효화
      await this.cacheService.invalidateUserSubscriptionCaches(dto.userId, dto.creatorId);

      // 4. 성공 로깅
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

      // 3. 캐시 무효화
      await this.cacheService.invalidateUserSubscriptionCaches(userId, creatorId);

      // 4. 성공 로깅
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

  // ==================== 통계 메서드 ====================

  async getSubscriberCount(creatorId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.count({ where: { creatorId } }),
      'Get subscriber count',
      { creatorId }
    );
  }

  async getSubscriptionCount(userId: string): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.count({ where: { userId } }),
      'Get subscription count',
      { userId }
    );
  }

  // 배치 통계 메서드 (최적화됨 - 단일 쿼리)
  async getSubscriberCountsByCreatorIds(creatorIds: string[]): Promise<Record<string, number>> {
    return this.executeWithErrorHandling(
      async () => {
        if (creatorIds.length === 0) return {};

        // N번의 개별 count 쿼리 대신 단일 GROUP BY 쿼리 사용
        const result = await this.userSubscriptionRepo
          .createQueryBuilder('us')
          .select('us.creatorId, COUNT(*) as count')
          .where('us.creatorId IN (:...creatorIds)', { creatorIds })
          .groupBy('us.creatorId')
          .getRawMany();

        // 결과를 Record 형태로 변환
        const subscriberCounts: Record<string, number> = {};
        
        // 모든 creatorId에 대해 0으로 초기화
        creatorIds.forEach(creatorId => {
          subscriberCounts[creatorId] = 0;
        });
        
        // 실제 구독자가 있는 크리에이터의 카운트 설정
        result.forEach(row => {
          subscriberCounts[row.us_creatorId] = parseInt(row.count, 10);
        });

        this.logger.debug('Subscriber counts fetched in batch', {
          creatorCount: creatorIds.length,
          queriedCount: result.length,
        });

        return subscriberCounts;
      },
      'Get subscriber counts batch',
      { creatorCount: creatorIds.length },
      {} // 에러 시 빈 객체 반환
    );
  }

  // ==================== 상세 조회 메서드 ====================

  async getSubscriptionDetail(
    userId: string,
    creatorId: string
  ): Promise<UserSubscriptionEntity | null> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.findOne({ where: { userId, creatorId } }),
      'Get subscription detail',
      { userId, creatorId }
    );
  }

  async getSubscriptionsByUserId(userId: string): Promise<UserSubscriptionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.find({ where: { userId } }),
      'Get subscriptions by user ID',
      { userId }
    );
  }

  async getSubscriptionsByCreatorId(creatorId: string): Promise<UserSubscriptionEntity[]> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.find({ where: { creatorId } }),
      'Get subscriptions by creator ID',
      { creatorId }
    );
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.executeWithErrorHandling(
      () => this.userSubscriptionRepo.count(),
      'Get total subscription count',
      {},
      0 // fallback value
    );
  }

  // ==================== 최적화 메서드 (필수) ====================

  async hasUsersForCreator(creatorId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      async () => {
        const count = await this.userSubscriptionRepo.count({ where: { creatorId } });
        return count > 0;
      },
      'Check users for creator',
      { creatorId }
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
      
      throw UserSubscriptionException.subscriptionFetchError();
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
}
