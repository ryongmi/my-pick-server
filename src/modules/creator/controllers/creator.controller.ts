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
  SwaggerApiBody,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { RequirePermission } from '@krgeobuk/authorization/decorators';

import { CreatorService } from '../services/index.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreatorStatsDto,
  CreatorPlatformDto,
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
  @SwaggerApiPaginatedResponse({ dto: CreatorSearchResultDto, status: 200, description: '크리에이터 목록 조회 성공' })
  async getCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query) as any;
  }

  @Get(':id')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 상세 조회 (로그인 필요)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorDetailDto, status: 200, description: '크리에이터 상세 조회 성공' })
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
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorStatsDto, status: 200, description: '크리에이터 통계 조회 성공' })
  @Serialize({ dto: CreatorStatsDto })
  async getCreatorStats(@Param('id', ParseUUIDPipe) creatorId: string): Promise<CreatorStatsDto> {
    const creator = await this.creatorService.findByIdOrFail(creatorId);
    const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    // TODO: CreatorPlatformEntity에서 통계 합계 계산하도록 수정 필요
    return {
      subscriberCount,
      followerCount: 0, // TODO: CreatorPlatformEntity에서 총합 계산
      contentCount: 0, // TODO: CreatorPlatformEntity에서 총합 계산  
      totalViews: 0, // TODO: CreatorPlatformEntity에서 총합 계산
    };
  }

  // ==================== PLATFORM 조회 API ====================

  @Get(':id/platforms')
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 목록 조회 (공개)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorPlatformDto, status: 200, description: '크리에이터 플랫폼 목록 조회 성공', isArray: true })
  @Serialize({ dto: CreatorPlatformDto })
  async getCreatorPlatforms(
    @Param('id', ParseUUIDPipe) creatorId: string
  ): Promise<CreatorPlatformDto[]> {
    return this.creatorService.getCreatorPlatforms(creatorId);
  }
}

