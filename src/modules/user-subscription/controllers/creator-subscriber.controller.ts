import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequirePermission } from '@krgeobuk/authorization/decorators';

import { UserSubscriptionService } from '../services/index.js';

@SwaggerApiTags({ tags: ['creator-subscribers'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('creators/:creatorId/subscribers')
export class CreatorSubscriberController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  @Get('count')
  @SwaggerApiOperation({ summary: '크리에이터 구독자 수 조회' })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ 
    status: 200,
    description: '구독자 수 조회 성공'
  })
  async getSubscriberCount(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ count: number }> {
    const count = await this.userSubscriptionService.getSubscriberCount(creatorId);
    return { count };
  }

  @Get()
  @SwaggerApiOperation({ summary: '크리에이터 구독자 목록 조회' })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독자 ID 목록 조회 성공'
  })
  // @RequirePermission('creator.subscribers.read')
  async getSubscribers(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ userIds: string[] }> {
    const userIds = await this.userSubscriptionService.getUserIds(creatorId);
    return { userIds };
  }
}
