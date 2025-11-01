import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';

import { UserSubscriptionService } from '../services/user-subscription.service.js';
import { UpdateNotificationDto } from '../dto/index.js';

/**
 * 사용자 본인의 구독 관리 컨트롤러
 * JWT에서 userId를 추출하여 사용
 */
@Controller('subscriptions')
@UseGuards(AccessTokenGuard)
export class SubscriptionController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  /**
   * 내가 구독한 크리에이터 ID 목록 조회
   * GET /subscriptions
   */
  @Get()
  async getMySubscriptions(@CurrentJwt() jwt: AuthenticatedJwt): Promise<string[]> {
    return this.userSubscriptionService.getCreatorIds(jwt.userId);
  }

  /**
   * 알림 활성화된 구독 크리에이터 목록 조회
   * GET /subscriptions/notifications
   */
  @Get('notifications')
  async getNotificationEnabledSubscriptions(
    @CurrentJwt() jwt: AuthenticatedJwt
  ): Promise<string[]> {
    return this.userSubscriptionService.getNotificationEnabledCreatorIds(jwt.userId);
  }

  /**
   * 크리에이터 구독
   * POST /subscriptions
   */
  @Post(':creatorId')
  @HttpCode(HttpStatus.CREATED)
  async subscribeToCreator(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Param('creatorId') creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.subscribeToCreator(jwt.userId, creatorId);
  }

  /**
   * 구독 여부 확인
   * GET /subscriptions/:creatorId/check
   */
  @Get(':creatorId/check')
  async checkSubscription(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Param('creatorId') creatorId: string
  ): Promise<{ isSubscribed: boolean }> {
    const isSubscribed = await this.userSubscriptionService.isSubscribed(jwt.userId, creatorId);
    return { isSubscribed };
  }

  /**
   * 알림 설정 업데이트
   * PATCH /subscriptions/:creatorId/notification
   */
  @Patch(':creatorId/notification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateNotificationSetting(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Param('creatorId') creatorId: string,
    @Body() dto: UpdateNotificationDto
  ): Promise<void> {
    await this.userSubscriptionService.updateNotificationSetting(
      jwt.userId,
      creatorId,
      dto.notificationEnabled
    );
  }

  /**
   * 크리에이터 구독 취소
   * DELETE /subscriptions/:creatorId
   */
  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribeFromCreator(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Param('creatorId') creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(jwt.userId, creatorId);
  }
}
