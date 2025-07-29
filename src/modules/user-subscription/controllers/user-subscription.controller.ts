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

import { UserSubscriptionService } from '../services';
import { CreatorService } from '../../creator/services';
import { SubscribeCreatorDto } from '../dto';
import { CreatorSearchResultDto } from '../../creator/dto';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { AuthGuard, CurrentUser, RequirePermission } from '@krgeobuk/authorization';

// 임시 인터페이스 (실제로는 @krgeobuk/authorization에서 import)
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const AuthGuard = () => () => {};
const CurrentUser = () => (target: any, propertyKey: string, parameterIndex: number) => {};
const RequirePermission = (permission: string) => () => {};

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
  @SwaggerApiOperation({ summary: '사용자 구독 목록 조회' })
  @SwaggerApiParam({ name: 'userId', description: '사용자 ID' })
  @SwaggerApiOkResponse({ type: [CreatorSearchResultDto] })
  @SwaggerApiOkResponse({ dto: CreatorSearchResultDto, status: 200, description: '' })
  // @UseGuards(AuthGuard)
  // @RequirePermission('user.subscriptions.read')
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
  @SwaggerApiOperation({ summary: '구독 관계 존재 확인' })
  @SwaggerApiParam({ name: 'userId', description: '사용자 ID' })
  @SwaggerApiParam({ name: 'creatorId', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ schema: { properties: { exists: { type: 'boolean' } } } })
  // @UseGuards(AuthGuard)
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
  @SwaggerApiParam({ name: 'userId', description: '사용자 ID' })
  @SwaggerApiParam({ name: 'creatorId', description: '크리에이터 ID' })
  @SwaggerApiBody({
    schema: {
      properties: {
        notificationEnabled: { type: 'boolean', description: '알림 활성화 여부' },
      },
    },
  })
  // @UseGuards(AuthGuard)
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
  @SwaggerApiParam({ name: 'userId', description: '사용자 ID' })
  @SwaggerApiParam({ name: 'creatorId', description: '크리에이터 ID' })
  // @UseGuards(AuthGuard)
  async deleteSubscription(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<void> {
    await this.userSubscriptionService.unsubscribeFromCreator(userId, creatorId);
  }
}

