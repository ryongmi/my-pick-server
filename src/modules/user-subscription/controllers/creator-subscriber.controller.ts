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

import { UserSubscriptionService } from '../services/index.js';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { RequirePermission } from '@krgeobuk/authorization';

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const RequirePermission = (permission: string) => () => {};

@SwaggerApiTags({ tags: ['creator-subscribers'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('creators/:creatorId/subscribers')
export class CreatorSubscriberController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  @Get('count')
  @SwaggerApiOperation({ summary: '크리에이터 구독자 수 조회' })
  @SwaggerApiParam({ name: 'creatorId', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ schema: { properties: { count: { type: 'number' } } } })
  async getSubscriberCount(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ count: number }> {
    const count = await this.userSubscriptionService.getSubscriberCount(creatorId);
    return { count };
  }

  @Get()
  @SwaggerApiOperation({ summary: '크리에이터 구독자 목록 조회' })
  @SwaggerApiParam({ name: 'creatorId', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    schema: { properties: { userIds: { type: 'array', items: { type: 'string' } } } },
  })
  // @RequirePermission('creator.subscribers.read')
  async getSubscribers(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ userIds: string[] }> {
    const userIds = await this.userSubscriptionService.getUserIds(creatorId);
    return { userIds };
  }
}
