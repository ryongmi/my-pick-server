import { Injectable, Logger } from '@nestjs/common';

import { EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import { CreatorService } from '../../creator/services/index.js';
import { SubscribeCreatorDto } from '../dto/index.js';
import { CreatorSearchResultDto } from '../../creator/dto/index.js';

import { UserSubscriptionService } from './user-subscription.service.js';

// Interface definitions for orchestration service
export interface SubscribeToCreatorCompleteDto {
  userId: string;
  creatorId: string;
  notificationEnabled: boolean;
}

export interface CreatorSubscriptionStatsDto {
  creatorId: string;
  subscriberCount: number;
  hasSubscribers: boolean;
  lastSubscribedAt?: Date;
}

@Injectable()
export class UserSubscriptionOrchestrationService {
  private readonly logger = new Logger(UserSubscriptionOrchestrationService.name);

  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly creatorService: CreatorService
  ) {}

  // ==================== 복합 구독 작업 ====================

  /**
   * 크리에이터 검증 후 구독 생성
   * 컨트롤러에서 분리된 비즈니스 로직
   */
  async subscribeToCreatorComplete(
    dto: SubscribeToCreatorCompleteDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(dto.creatorId);

      // 2. 구독 생성
      const subscribeDto: SubscribeCreatorDto = {
        userId: dto.userId,
        creatorId: dto.creatorId,
        notificationEnabled: dto.notificationEnabled,
      };

      await this.userSubscriptionService.subscribeToCreator(subscribeDto, transactionManager);

      this.logger.log('Creator subscription completed successfully', {
        userId: dto.userId,
        creatorId: dto.creatorId,
        notificationEnabled: dto.notificationEnabled,
      });
    } catch (error: unknown) {
      this.logger.error('Creator subscription completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        creatorId: dto.creatorId,
      });
      throw error; // Re-throw the original error
    }
  }

  /**
   * 사용자 구독 목록 조회 + 크리에이터 정보 조합
   * 컨트롤러에서 분리된 복합 조회 로직
   */
  async getSubscriptionsWithCreatorInfo(userId: string): Promise<CreatorSearchResultDto[]> {
    try {
      // 1. 사용자 구독 목록 조회
      const subscriptions = await this.userSubscriptionService.getSubscriptionsByUserId(userId);
      const creatorIds = subscriptions.map((sub) => sub.creatorId);

      if (creatorIds.length === 0) {
        this.logger.debug('No subscriptions found for user', { userId });
        return [];
      }

      // 2. 크리에이터 정보 조회
      const creators = await this.creatorService.findByIds(creatorIds);

      // 3. DTO 변환
      const result = creators.map((creator) =>
        plainToInstance(CreatorSearchResultDto, creator, {
          excludeExtraneousValues: true,
        })
      );

      this.logger.debug('User subscriptions with creator info fetched', {
        userId,
        subscriptionCount: subscriptions.length,
        creatorCount: creators.length,
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Get subscriptions with creator info failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }

  /**
   * 크리에이터 검증 후 구독자 목록 조회
   * 컨트롤러에서 분리된 비즈니스 로직
   */
  async getCreatorSubscribersWithValidation(
    creatorId: string
  ): Promise<{ creatorId: string; userIds: string[]; totalCount: number }> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(creatorId);

      // 2. 구독자 ID 목록 조회
      const userIds = await this.userSubscriptionService.getUserIds(creatorId);

      const result = {
        creatorId,
        userIds,
        totalCount: userIds.length,
      };

      this.logger.debug('Creator subscribers fetched with validation', {
        creatorId,
        subscriberCount: userIds.length,
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Get creator subscribers with validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw error;
    }
  }

  /**
   * 크리에이터 검증 후 구독자 수 조회
   * 컨트롤러에서 분리된 비즈니스 로직
   */
  async getSubscriberCountWithValidation(
    creatorId: string
  ): Promise<{ creatorId: string; subscriberCount: number }> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(creatorId);

      // 2. 구독자 수 조회
      const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

      const result = {
        creatorId,
        subscriberCount,
      };

      this.logger.debug('Subscriber count fetched with validation', {
        creatorId,
        subscriberCount,
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Get subscriber count with validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw error;
    }
  }

  /**
   * 크리에이터 검증 후 구독 통계 조회 (관리자용)
   * 컨트롤러에서 분리된 복합 통계 로직
   */
  async getSubscriptionStatsWithValidation(creatorId: string): Promise<CreatorSubscriptionStatsDto> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(creatorId);

      // 2. 구독자 수와 구독 목록 병렬 조회
      const [subscriberCount, subscriptions] = await Promise.all([
        this.userSubscriptionService.getSubscriberCount(creatorId),
        this.userSubscriptionService.getSubscriptionsByCreatorId(creatorId),
      ]);

      // 3. 가장 최근 구독 날짜 계산
      const lastSubscribedAt =
        subscriptions.length > 0
          ? subscriptions.reduce(
              (latest, sub) => (sub.subscribedAt > latest ? sub.subscribedAt : latest),
              subscriptions[0]!.subscribedAt
            )
          : undefined;

      const result: CreatorSubscriptionStatsDto = {
        creatorId,
        subscriberCount,
        hasSubscribers: subscriberCount > 0,
      };

      if (lastSubscribedAt) {
        result.lastSubscribedAt = lastSubscribedAt;
      }

      this.logger.debug('Subscription stats fetched with validation', {
        creatorId,
        subscriberCount,
        hasSubscribers: result.hasSubscribers,
        hasLastSubscribedAt: !!lastSubscribedAt,
      });

      return result;
    } catch (error: unknown) {
      this.logger.error('Get subscription stats with validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw error;
    }
  }

  // ==================== 단순 위임 메서드 (선택적) ====================

  /**
   * 구독 관계 존재 확인 (크리에이터 검증 없음)
   * 단순 위임이므로 직접 서비스 호출 권장
   */
  async checkSubscriptionExists(userId: string, creatorId: string): Promise<{ exists: boolean }> {
    const exists = await this.userSubscriptionService.exists(userId, creatorId);
    return { exists };
  }

  /**
   * 구독 해제 (크리에이터 검증 없음)
   * 단순 위임이므로 직접 서비스 호출 권장
   */
  async unsubscribeFromCreator(userId: string, creatorId: string, _transactionManager?: EntityManager): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(userId, creatorId);
  }
}