import { Controller, Get, Param } from '@nestjs/common';

import { UserSubscriptionService } from '../services/user-subscription.service.js';

@Controller('creators/:creatorId/subscribers')
export class CreatorSubscriptionController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  /**
   * 크리에이터의 구독자 ID 목록 조회
   */
  @Get()
  async getCreatorSubscribers(@Param('creatorId') creatorId: string): Promise<string[]> {
    return this.userSubscriptionService.getUserIds(creatorId);
  }

  /**
   * 크리에이터의 구독자 수 조회
   */
  @Get('count')
  async getSubscriptionCount(@Param('creatorId') creatorId: string): Promise<{ count: number }> {
    const count = await this.userSubscriptionService.getSubscriptionCount(creatorId);
    return { count };
  }

  /**
   * 구독자 존재 여부 확인
   */
  @Get('exists')
  async checkHasSubscribers(
    @Param('creatorId') creatorId: string
  ): Promise<{ hasSubscribers: boolean }> {
    const hasSubscribers = await this.userSubscriptionService.hasSubscribers(creatorId);
    return { hasSubscribers };
  }
}
