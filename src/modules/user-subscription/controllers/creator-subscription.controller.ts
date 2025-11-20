import { Controller, Get, Param } from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiParam,
} from '@krgeobuk/swagger';

import { UserSubscriptionService } from '../services/user-subscription.service.js';

@SwaggerApiTags({ tags: ['creator-subscribers'] })
@Controller('creators/:creatorId/subscribers')
export class CreatorSubscriptionController {
  constructor(private readonly userSubscriptionService: UserSubscriptionService) {}

  /**
   * 크리에이터의 구독자 ID 목록 조회
   */
  @SwaggerApiOperation({
    summary: '크리에이터 구독자 목록',
    description: '특정 크리에이터의 구독자 ID 목록을 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독자 목록 조회 성공 (사용자 ID 배열)',
  })
  @Get()
  async getCreatorSubscribers(@Param('creatorId') creatorId: string): Promise<string[]> {
    return this.userSubscriptionService.getUserIds(creatorId);
  }

  /**
   * 크리에이터의 구독자 수 조회
   */
  @SwaggerApiOperation({
    summary: '크리에이터 구독자 수',
    description: '특정 크리에이터의 구독자 수를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독자 수 조회 성공 (응답: { count: number })',
  })
  @Get('count')
  async getSubscriptionCount(@Param('creatorId') creatorId: string): Promise<{ count: number }> {
    const count = await this.userSubscriptionService.getSubscriptionCount(creatorId);
    return { count };
  }

  /**
   * 구독자 존재 여부 확인
   */
  @SwaggerApiOperation({
    summary: '구독자 존재 여부',
    description: '특정 크리에이터에게 구독자가 있는지 확인합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독자 존재 여부 확인 성공 (응답: { hasSubscribers: boolean })',
  })
  @Get('exists')
  async checkHasSubscribers(
    @Param('creatorId') creatorId: string
  ): Promise<{ hasSubscribers: boolean }> {
    const hasSubscribers = await this.userSubscriptionService.hasSubscribers(creatorId);
    return { hasSubscribers };
  }
}
