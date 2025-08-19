import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { EntityManager } from 'typeorm';


import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiBody,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';

import { UserSubscriptionOrchestrationService } from '../services/index.js';
import { CreatorSearchResultDto } from '../../creator/dto/index.js';
import { SubscribeCreatorDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['user-subscriptions'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('me/subscriptions')
export class UserSubscriptionController {
  constructor(
    private readonly orchestrationService: UserSubscriptionOrchestrationService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '사용자 구독 목록 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '사용자 구독 목록 조회 성공',
    dto: CreatorSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '사용자를 찾을 수 없습니다.',
  })
  @Serialize({ dto: CreatorSearchResultDto })
  async getUserSubscriptions(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<CreatorSearchResultDto[]> {
    return await this.orchestrationService.getSubscriptionsWithCreatorInfo(userId);
  }

  @Get(':creatorId/exists')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '구독 관계 존재 확인' })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독 관계 존재 확인 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '사용자 또는 크리에이터를 찾을 수 없습니다.',
  })
  async checkSubscriptionExists(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ exists: boolean }> {
    return await this.orchestrationService.checkSubscriptionExists(userId, creatorId);
  }

  @Post(':creatorId')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ 
    summary: '크리에이터 구독하기',
    description: '크리에이터를 구독하고 트랜잭션을 통해 데이터 일관성을 보장합니다.'
  })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({
    dto: SubscribeCreatorDto,
    description: '구독 정보',
  })
  @SwaggerApiOkResponse({
    status: 201,
    description: '크리에이터 구독이 성공적으로 생성되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 409,
    description: '이미 구독 중인 크리에이터입니다.',
  })
  async createSubscription(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Body() body: { notificationEnabled?: boolean } = {},
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    const dto = {
      userId,
      creatorId,
      notificationEnabled: body.notificationEnabled ?? false,
    };

    await this.orchestrationService.subscribeToCreatorComplete(dto, transactionManager);
  }

  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ 
    summary: '크리에이터 구독 해제',
    description: '크리에이터 구독을 해제하고 트랜잭션을 통해 데이터 일관성을 보장합니다.'
  })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 204,
    description: '크리에이터 구독이 성공적으로 해제되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '구독 관계를 찾을 수 없습니다.',
  })
  async deleteSubscription(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    await this.orchestrationService.unsubscribeFromCreator(userId, creatorId, transactionManager);
  }
}
