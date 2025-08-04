import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
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
import { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { UserSubscriptionService } from '../services/index.js';
import { CreatorService } from '../../creator/services/index.js';

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
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly creatorService: CreatorService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ 
    summary: '크리에이터 구독자 목록 조회',
    description: '특정 크리에이터의 구독자 사용자 ID 목록을 조회합니다.'
  })
  @SwaggerApiParam({ 
    name: 'creatorId', 
    type: String, 
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
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
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ creatorId: string; userIds: string[]; totalCount: number }> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    // 구독자 ID 목록 조회
    const userIds = await this.userSubscriptionService.getUserIds(creatorId);

    return {
      creatorId,
      userIds,
      totalCount: userIds.length,
    };
  }

  @Get('count')
  @HttpCode(200)
  @SwaggerApiOperation({ 
    summary: '크리에이터 구독자 수 조회',
    description: '특정 크리에이터의 구독자 수를 조회합니다.'
  })
  @SwaggerApiParam({ 
    name: 'creatorId', 
    type: String, 
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
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
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ creatorId: string; subscriberCount: number }> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    // 구독자 수 조회
    const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    return {
      creatorId,
      subscriberCount,
    };
  }

  @Get('stats')
  @RequireRole('superAdmin')
  @HttpCode(200)
  @SwaggerApiOperation({ 
    summary: '크리에이터 구독 통계 조회 (관리자 전용)',
    description: '특정 크리에이터의 구독 관련 상세 통계를 조회합니다.'
  })
  @SwaggerApiParam({ 
    name: 'creatorId', 
    type: String, 
    description: '크리에이터 ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
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
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{
    creatorId: string;
    subscriberCount: number;
    hasSubscribers: boolean;
    lastSubscribedAt?: Date;
  }> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    const [subscriberCount, subscriptions] = await Promise.all([
      this.userSubscriptionService.getSubscriberCount(creatorId),
      this.userSubscriptionService.getSubscriptionsByCreatorId(creatorId),
    ]);

    // 가장 최근 구독 날짜 찾기
    const lastSubscribedAt = subscriptions.length > 0 
      ? subscriptions.reduce((latest, sub) => 
          sub.subscribedAt > latest ? sub.subscribedAt : latest, 
          subscriptions[0].subscribedAt
        )
      : undefined;

    return {
      creatorId,
      subscriberCount,
      hasSubscribers: subscriberCount > 0,
      lastSubscribedAt,
    };
  }
}