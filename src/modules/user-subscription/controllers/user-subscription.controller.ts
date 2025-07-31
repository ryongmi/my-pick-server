import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { Serialize } from '@krgeobuk/core/decorators';
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

import { UserSubscriptionService } from '../services/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { SubscribeCreatorDto } from '../dto/index.js';
import { CreatorSearchResultDto } from '../../creator/dto/index.js';


@SwaggerApiTags({ tags: ['user-subscriptions'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('users/:userId/subscriptions')
export class UserSubscriptionController {
  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly creatorService: CreatorService
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '사용자 구독 목록 조회' })
  @SwaggerApiParam({ name: 'userId', type: String, description: '사용자 ID' })
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
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<CreatorSearchResultDto[]> {
    const subscriptions = await this.userSubscriptionService.getSubscriptionsByUserId(userId);
    const creatorIds = subscriptions.map((sub) => sub.creatorId);

    if (creatorIds.length === 0) {
      return [];
    }

    const creators = await this.creatorService.findByIds(creatorIds);

    return creators.map((creator) =>
      plainToInstance(CreatorSearchResultDto, creator, {
        excludeExtraneousValues: true,
      })
    );
  }

  @Get(':creatorId/exists')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '구독 관계 존재 확인' })
  @SwaggerApiParam({ name: 'userId', type: String, description: '사용자 ID' })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '구독 관계 존재 확인 성공'
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '사용자 또는 크리에이터를 찾을 수 없습니다.',
  })
  async checkSubscriptionExists(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<{ exists: boolean }> {
    const exists = await this.userSubscriptionService.exists(userId, creatorId);
    return { exists };
  }

  @Post(':creatorId')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerApiOperation({ summary: '크리에이터 구독하기' })
  @SwaggerApiParam({ name: 'userId', type: String, description: '사용자 ID' })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({
    dto: SubscribeCreatorDto,
    description: '구독 정보'
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
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Body() body: { notificationEnabled?: boolean } = {}
  ): Promise<void> {
    // 크리에이터 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    const dto: SubscribeCreatorDto = {
      userId,
      creatorId,
      notificationEnabled: body.notificationEnabled,
    };

    await this.userSubscriptionService.subscribeToCreator(dto);
  }

  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '크리에이터 구독 해제' })
  @SwaggerApiParam({ name: 'userId', type: String, description: '사용자 ID' })
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
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(userId, creatorId);
  }
}

