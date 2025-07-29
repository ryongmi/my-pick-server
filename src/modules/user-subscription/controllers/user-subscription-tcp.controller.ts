import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { UserSubscriptionService } from '../services';
import { SubscribeCreatorDto } from '../dto';

@Controller()
export class UserSubscriptionTcpController {
  private readonly logger = new Logger(UserSubscriptionTcpController.name);

  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
  ) {}

  // ==================== 중간테이블 조회 패턴 ====================

  @MessagePattern('userSubscription.getCreatorIds')
  async getCreatorIdsByUserId(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user subscriptions request: ${data.userId}`);
    return await this.userSubscriptionService.getCreatorIds(data.userId);
  }

  @MessagePattern('userSubscription.getUserIds')
  async getUserIdsByCreatorId(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator subscribers request: ${data.creatorId}`);
    return await this.userSubscriptionService.getUserIds(data.creatorId);
  }

  @MessagePattern('userSubscription.exists')
  async checkSubscriptionExists(
    @Payload() data: { userId: string; creatorId: string },
  ) {
    this.logger.debug('TCP subscription check request', {
      userId: data.userId,
      creatorId: data.creatorId,
    });
    return await this.userSubscriptionService.exists(data.userId, data.creatorId);
  }

  @MessagePattern('userSubscription.getCreatorIdsBatch')
  async getCreatorIdsBatch(@Payload() data: { userIds: string[] }) {
    this.logger.debug('TCP batch creator IDs request', {
      userCount: data.userIds.length,
    });
    return await this.userSubscriptionService.getCreatorIdsBatch(data.userIds);
  }

  @MessagePattern('userSubscription.hasUsersForCreator')
  async hasUsersForCreator(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator has users check: ${data.creatorId}`);
    return await this.userSubscriptionService.hasUsersForCreator(data.creatorId);
  }

  // ==================== 변경 작업 패턴 ====================

  @MessagePattern('userSubscription.subscribe')
  async subscribeToCreator(
    @Payload() data: { userId: string; creatorId: string; notificationEnabled?: boolean },
  ) {
    this.logger.log('TCP subscription create request', {
      userId: data.userId,
      creatorId: data.creatorId,
    });
    return await this.userSubscriptionService.subscribeToCreator(data);
  }

  @MessagePattern('userSubscription.unsubscribe')
  async unsubscribeFromCreator(
    @Payload() data: { userId: string; creatorId: string },
  ) {
    this.logger.log('TCP subscription delete request', {
      userId: data.userId,
      creatorId: data.creatorId,
    });
    return await this.userSubscriptionService.unsubscribeFromCreator(
      data.userId,
      data.creatorId,
    );
  }

  // ==================== 통계 패턴 ====================

  @MessagePattern('creator.getSubscriptionCount')
  async getSubscriptionCount(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user subscription count request: ${data.userId}`);
    return await this.userSubscriptionService.getSubscriptionCount(data.userId);
  }

  // ==================== 상세 조회 패턴 ====================

  @MessagePattern('userSubscription.getDetail')
  async getSubscriptionDetail(
    @Payload() data: { userId: string; creatorId: string },
  ) {
    this.logger.debug('TCP subscription detail request', {
      userId: data.userId,
      creatorId: data.creatorId,
    });
    return await this.userSubscriptionService.getSubscriptionDetail(
      data.userId,
      data.creatorId,
    );
  }

  @MessagePattern('userSubscription.getByUserId')
  async getSubscriptionsByUserId(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user all subscriptions request: ${data.userId}`);
    return await this.userSubscriptionService.getSubscriptionsByUserId(data.userId);
  }

  @MessagePattern('userSubscription.getByCreatorId')
  async getSubscriptionsByCreatorId(@Payload() data: { creatorId: string }) {
    this.logger.debug(`TCP creator all subscriptions request: ${data.creatorId}`);
    return await this.userSubscriptionService.getSubscriptionsByCreatorId(data.creatorId);
  }
}