import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { PaginateBaseDto } from '@krgeobuk/core/dtos';
import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiErrorResponse,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiBearerAuth,
} from '@krgeobuk/swagger';

import { UserSubscriptionService } from '../services/user-subscription.service.js';
import { UpdateNotificationDto } from '../dto/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorSearchResultDto } from '../../creator/dto/index.js';

/**
 * 사용자 본인의 구독 관리 컨트롤러
 * JWT에서 userId를 추출하여 사용
 */
@SwaggerApiTags({ tags: ['subscriptions'] })
@SwaggerApiBearerAuth()
@Controller('subscriptions')
@UseGuards(AccessTokenGuard)
export class SubscriptionController {
  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly creatorService: CreatorService
  ) {}

  /**
   * 내가 구독한 크리에이터 상세 정보 조회 (페이지네이션)
   * GET /subscriptions?page=1&limit=20
   */
  @SwaggerApiOperation({
    summary: '내 구독 목록 조회',
    description: '내가 구독한 크리에이터의 상세 정보를 페이지네이션으로 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '구독 목록 조회 성공',
    dto: CreatorSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get()
  async getMySubscriptions(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Query() query: PaginateBaseDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    // 1. 구독한 크리에이터 ID 목록 조회
    const creatorIds = await this.userSubscriptionService.getCreatorIds(jwt.userId);

    // 2. CreatorService를 통해 전체 정보 조회 (페이지네이션 포함)
    const options: { page?: number; limit?: LimitType } = {};
    if (query.page !== undefined) options.page = query.page;
    if (query.limit !== undefined) options.limit = query.limit;

    return await this.creatorService.findByIdsWithDetails(creatorIds, options);
  }

  /**
   * 알림 활성화된 구독 크리에이터 목록 조회
   * GET /subscriptions/notifications
   */
  @SwaggerApiOperation({
    summary: '알림 활성화 구독 목록',
    description: '알림이 활성화된 구독 크리에이터의 ID 목록을 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '알림 활성화 구독 목록 조회 성공 (크리에이터 ID 배열)',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get('notifications')
  async getNotificationEnabledSubscriptions(
    @CurrentJwt() jwt: AuthenticatedJwt
  ): Promise<string[]> {
    return this.userSubscriptionService.getNotificationEnabledCreatorIds(jwt.userId);
  }

  /**
   * 크리에이터 구독
   * POST /subscriptions/:creatorId
   */
  @SwaggerApiOperation({
    summary: '크리에이터 구독',
    description: '특정 크리에이터를 구독합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 201,
    description: '구독 성공',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 구독 중입니다',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
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
  @SwaggerApiOperation({
    summary: '구독 여부 확인',
    description: '특정 크리에이터를 구독 중인지 확인합니다.',
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
    description: '구독 여부 확인 성공 (응답: { isSubscribed: boolean })',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
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
  @SwaggerApiOperation({
    summary: '알림 설정 변경',
    description: '특정 크리에이터의 알림 설정을 변경합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiBody({
    dto: UpdateNotificationDto,
    description: '알림 설정 정보',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '알림 설정 변경 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '구독 정보를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
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
  @SwaggerApiOperation({
    summary: '구독 취소',
    description: '특정 크리에이터의 구독을 취소합니다.',
  })
  @SwaggerApiParam({
    name: 'creatorId',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '구독 취소 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '구독 정보를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribeFromCreator(
    @CurrentJwt() jwt: AuthenticatedJwt,
    @Param('creatorId') creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(jwt.userId, creatorId);
  }
}
