import { Controller, Get, Post, Delete, Patch, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';

import { UserSubscriptionService } from '../services/user-subscription.service.js';
import { SubscribeCreatorDto, UpdateNotificationDto } from '../dto/index.js';

@Controller('users/:userId/subscriptions')
export class UserSubscriptionController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  /**
   * 사용자가 구독한 크리에이터 ID 목록 조회
   */
  @Get()
  async getUserSubscriptions(@Param('userId') userId: string): Promise<string[]> {
    return this.userSubscriptionService.getCreatorIds(userId);
  }

  /**
   * 알림 활성화된 구독 크리에이터 목록 조회
   */
  @Get('notifications')
  async getNotificationEnabledSubscriptions(@Param('userId') userId: string): Promise<string[]> {
    return this.userSubscriptionService.getNotificationEnabledCreatorIds(userId);
  }

  /**
   * 크리에이터 구독
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async subscribeToCreator(
    @Param('userId') userId: string,
    @Body() dto: SubscribeCreatorDto
  ): Promise<void> {
    await this.userSubscriptionService.subscribeToCreator(
      userId,
      dto.creatorId,
      dto.notificationEnabled ?? true
    );
  }

  /**
   * 구독 여부 확인
   */
  @Get(':creatorId/check')
  async checkSubscription(
    @Param('userId') userId: string,
    @Param('creatorId') creatorId: string
  ): Promise<{ isSubscribed: boolean }> {
    const isSubscribed = await this.userSubscriptionService.isSubscribed(userId, creatorId);
    return { isSubscribed };
  }

  /**
   * 알림 설정 업데이트
   */
  @Patch(':creatorId/notification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateNotificationSetting(
    @Param('userId') userId: string,
    @Param('creatorId') creatorId: string,
    @Body() dto: UpdateNotificationDto
  ): Promise<void> {
    await this.userSubscriptionService.updateNotificationSetting(
      userId,
      creatorId,
      dto.notificationEnabled
    );
  }

  /**
   * 크리에이터 구독 취소
   */
  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribeFromCreator(
    @Param('userId') userId: string,
    @Param('creatorId') creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(userId, creatorId);
  }
}
