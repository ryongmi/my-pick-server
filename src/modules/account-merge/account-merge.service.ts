import { Injectable, Logger } from '@nestjs/common';

import { UserSubscriptionService } from '../user-subscription/services/user-subscription.service.js';
import { UserInteractionService } from '../user-interaction/services/user-interaction.service.js';

@Injectable()
export class AccountMergeService {
  private readonly logger = new Logger(AccountMergeService.name);

  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly userInteractionService: UserInteractionService
  ) {}

  /**
   * MyPick 사용자 데이터 병합
   * sourceUserId의 모든 데이터를 targetUserId로 병합
   */
  async mergeUserData(sourceUserId: string, targetUserId: string): Promise<void> {
    try {
      this.logger.log('Starting MyPick user data merge', {
        sourceUserId,
        targetUserId,
      });

      // 1. 사용자 구독 병합
      await this.userSubscriptionService.mergeUserSubscriptions(sourceUserId, targetUserId);

      // 2. 사용자 인터랙션 병합
      await this.userInteractionService.mergeUserInteractions(sourceUserId, targetUserId);

      this.logger.log('MyPick user data merge completed successfully', {
        sourceUserId,
        targetUserId,
      });
    } catch (error: unknown) {
      this.logger.error('MyPick user data merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }

  /**
   * MyPick 사용자 데이터 병합 롤백 (보상 트랜잭션)
   * 병합된 데이터를 원래 사용자로 되돌림
   *
   * @param sourceUserId User B (원래 소유자)
   * @param targetUserId User A (병합 대상)
   * @param snapshot 백업된 데이터 (sourceCreatorIds, sourceContentIds 포함)
   */
  async rollbackMerge(
    sourceUserId: string,
    targetUserId: string,
    snapshot?: {
      sourceCreatorIds?: string[];
      sourceContentIds?: string[];
    }
  ): Promise<void> {
    try {
      this.logger.log('Starting MyPick user data merge rollback', {
        sourceUserId,
        targetUserId,
        hasSnapshot: !!snapshot,
      });

      // 스냅샷에서 원본 데이터 추출
      const sourceCreatorIds = snapshot?.sourceCreatorIds;
      const sourceContentIds = snapshot?.sourceContentIds;

      // 1. 사용자 구독 롤백
      await this.userSubscriptionService.rollbackMerge(
        sourceUserId,
        targetUserId,
        sourceCreatorIds
      );

      // 2. 사용자 인터랙션 롤백
      await this.userInteractionService.rollbackMerge(
        sourceUserId,
        targetUserId,
        sourceContentIds
      );

      this.logger.log('MyPick user data merge rollback completed successfully', {
        sourceUserId,
        targetUserId,
        restoredSubscriptions: sourceCreatorIds?.length || 0,
        restoredInteractions: sourceContentIds?.length || 0,
      });
    } catch (error: unknown) {
      this.logger.error('MyPick user data merge rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceUserId,
        targetUserId,
      });

      throw error;
    }
  }
}
