import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiCreatedResponse,
  SwaggerApiNoContentResponse,
  SwaggerApiBody,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { RequirePermission } from '@krgeobuk/authorization/decorators';

import { CreatorService } from '../services/index.js';
import { UserSubscriptionService } from '../../user-subscription/user-subscription.service.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  AddPlatformDto,
  UpdatePlatformDto,
  PaginatedResult,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['creators'] })
@Controller('creators')
export class CreatorController {
  constructor(
    private readonly creatorService: CreatorService,
    private readonly userSubscriptionService: UserSubscriptionService
  ) {}

  @Get()
  @SwaggerApiOperation({ summary: '크리에이터 목록 조회 (공개)' })
  @SwaggerApiPaginatedResponse(CreatorSearchResultDto)
  async getCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query);
  }

  @Get(':id')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 상세 조회 (로그인 필요)' })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ type: CreatorDetailDto })
  async getCreatorById(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<CreatorDetailDto> {
    return this.creatorService.getCreatorById(creatorId, id);
  }

  @Get(':id/stats')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 통계 조회 (로그인 필요)' })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    schema: {
      properties: {
        subscriberCount: { type: 'number' },
        followerCount: { type: 'number' },
        contentCount: { type: 'number' },
        totalViews: { type: 'number' },
      },
    },
  })
  async getCreatorStats(@Param('id', ParseUUIDPipe) creatorId: string): Promise<{
    subscriberCount: number;
    followerCount: number;
    contentCount: number;
    totalViews: number;
  }> {
    const creator = await this.creatorService.findByIdOrFail(creatorId);
    const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    return {
      subscriberCount,
      followerCount: creator.followerCount,
      contentCount: creator.contentCount,
      totalViews: Number(creator.totalViews),
    };
  }

  // ==================== PLATFORM 관리 API ====================

  @Post(':id/platforms')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @RequirePermission('creator.platform.create')
  @HttpCode(HttpStatus.CREATED)
  @SwaggerApiOperation({ summary: '크리에이터에 플랫폼 추가 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiBody({ type: AddPlatformDto })
  @SwaggerApiCreatedResponse({ description: '플랫폼이 성공적으로 추가되었습니다.' })
  async addPlatformToCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: AddPlatformDto,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    return this.creatorService.addPlatformToCreator(creatorId, dto);
  }

  @Patch('platforms/:platformId')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @RequirePermission('creator.platform.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 정보 수정 (관리자 전용)' })
  @SwaggerApiParam({ name: 'platformId', description: '플랫폼 ID' })
  @SwaggerApiBody({ type: UpdatePlatformDto })
  @SwaggerApiNoContentResponse({ description: '플랫폼 정보가 성공적으로 수정되었습니다.' })
  async updateCreatorPlatform(
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @Body() dto: UpdatePlatformDto,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    return this.creatorService.updateCreatorPlatform(platformId, dto);
  }

  @Delete('platforms/:platformId')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @RequirePermission('creator.platform.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 삭제 (관리자 전용)' })
  @SwaggerApiParam({ name: 'platformId', description: '플랫폼 ID' })
  @SwaggerApiNoContentResponse({ description: '플랫폼이 성공적으로 삭제되었습니다.' })
  async removeCreatorPlatform(
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    return this.creatorService.removeCreatorPlatform(platformId);
  }

  @Post('platforms/:platformId/sync')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @RequirePermission('creator.platform.sync')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '플랫폼 데이터 동기화 (관리자 전용)' })
  @SwaggerApiParam({ name: 'platformId', description: '플랫폼 ID' })
  @SwaggerApiNoContentResponse({ description: '플랫폼 데이터가 성공적으로 동기화되었습니다.' })
  async syncPlatformData(
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    return this.creatorService.syncPlatformData(platformId);
  }
}

