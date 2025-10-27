import { Controller, Get, Param, UseGuards, HttpCode, ParseUUIDPipe } from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';

import { UserSubscriptionOrchestrationService } from '../services/index.js';

/**
 * 크리에이터 관점의 구독 관리 컨트롤러
 * krgeobuk 중간테이블 표준에 따른 양방향 API 제공
 */
@SwaggerApiTags({ tags: ['creator-subscriptions'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('creators/:creatorId/subscribers')
export class CreatorSubscriptionController {
  constructor(
    private readonly orchestrationService: UserSubscriptionOrchestrationService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({
    summary: '크리에이터 구독자 목록 조회',
    description: '특정 크리에이터의 구독자 사용자 ID 목록을 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 구독자 목록 조회 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  async getCreatorSubscribers(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() _jwt: AuthenticatedJwt
  ): Promise<{ creatorId: string; userIds: string[]; totalCount: number }> {
    return await this.orchestrationService.getCreatorSubscribersWithValidation(creatorId);
  }

  @Get('count')
  @HttpCode(200)
  @SwaggerApiOperation({
    summary: '크리에이터 구독자 수 조회',
    description: '특정 크리에이터의 구독자 수를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 구독자 수 조회 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  async getSubscriberCount(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() _jwt: AuthenticatedJwt
  ): Promise<{ creatorId: string; subscriberCount: number }> {
    return await this.orchestrationService.getSubscriberCountWithValidation(creatorId);
  }

  @Get('stats')
  @RequireRole('superAdmin')
  @HttpCode(200)
  @SwaggerApiOperation({
    summary: '크리에이터 구독 통계 조회 (관리자 전용)',
    description: '특정 크리에이터의 구독 관련 상세 통계를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 구독 통계 조회 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  async getSubscriptionStats(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() _jwt: AuthenticatedJwt
  ): Promise<{
    creatorId: string;
    subscriberCount: number;
    hasSubscribers: boolean;
    lastSubscribedAt?: Date;
  }> {
    return await this.orchestrationService.getSubscriptionStatsWithValidation(creatorId);
  }
}
