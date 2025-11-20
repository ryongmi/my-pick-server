import { Controller, Get, Query, Param, HttpCode, UseGuards } from '@nestjs/common';

import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { Serialize } from '@krgeobuk/core/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiErrorResponse,
  SwaggerApiParam,
  SwaggerApiBearerAuth,
} from '@krgeobuk/swagger';

import { CreatorService } from '../services/creator.service.js';
import { CreatorPlatformService } from '../services/creator-platform.service.js';
import { CreatorSearchQueryDto, CreatorSearchResultDto, CreatorDetailDto } from '../dto/index.js';
import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';

@SwaggerApiTags({ tags: ['creators'] })
@Controller('creators')
export class CreatorController {
  constructor(
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService
  ) {}

  /**
   * 크리에이터 검색
   * GET /creators?page=1&limit=30&name=ado&platform=youtube&orderBy=followers
   * - 로그인 시: 구독 여부(isSubscribed) 포함
   * - 비로그인: 구독 여부 없이 기본 정보만
   */
  @SwaggerApiOperation({
    summary: '크리에이터 검색',
    description: '크리에이터를 이름, 플랫폼, 정렬 기준으로 검색합니다. 로그인 시 구독 여부(isSubscribed)가 포함됩니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '크리에이터 목록 조회 성공',
    dto: CreatorSearchResultDto,
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 검색 파라미터',
  })
  @Get()
  @UseGuards(OptionalAccessTokenGuard)
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 목록 조회 성공',
  })
  async searchCreators(
    @Query() query: CreatorSearchQueryDto,
    @CurrentJwt() jwt: AuthenticatedJwt
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query, jwt?.userId);
  }

  /**
   * 크리에이터 상세 조회 (플랫폼 + 사용자 정보 포함)
   * GET /creators/:id
   */
  @SwaggerApiOperation({
    summary: '크리에이터 상세 조회',
    description: '특정 크리에이터의 상세 정보를 조회합니다. 플랫폼 계정 목록과 사용자 정보가 포함됩니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 상세 조회 성공',
    dto: CreatorDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get(':id')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 상세 조회 성공',
  })
  async getCreatorDetail(@Param('id') id: string): Promise<CreatorDetailDto> {
    return await this.creatorService.getDetailById(id);
  }

  /**
   * 크리에이터 연동 플랫폼 목록 조회
   * GET /creators/:id/platforms
   */
  @SwaggerApiOperation({
    summary: '크리에이터 플랫폼 목록 조회',
    description: '크리에이터가 연동한 모든 플랫폼 계정을 조회합니다 (YouTube, Twitter 등).',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '크리에이터 ID',
    required: true,
    example: 'ado',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 플랫폼 목록 조회 성공',
    dto: CreatorPlatformEntity,
    isArray: true,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get(':id/platforms')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 플랫폼 목록 조회 성공',
  })
  async getCreatorPlatforms(@Param('id') id: string): Promise<CreatorPlatformEntity[]> {
    // 크리에이터 존재 여부 확인
    await this.creatorService.findByIdOrFail(id);

    // 플랫폼 목록 조회
    return await this.creatorPlatformService.findByCreatorId(id);
  }

  // ==================== CREATOR DASHBOARD APIs ====================

  /**
   * 현재 로그인한 사용자의 크리에이터 정보 조회
   * GET /creators/me
   */
  @SwaggerApiOperation({
    summary: '내 크리에이터 정보 조회',
    description: '현재 로그인한 사용자의 크리에이터 정보를 조회합니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 정보 조회 성공',
    dto: CreatorDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터 정보를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get('me')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @HttpCode(200)
  @Serialize({
    message: '크리에이터 정보 조회 성공',
  })
  async getMyCreatorInfo(@CurrentJwt() { userId }: AuthenticatedJwt): Promise<CreatorDetailDto> {
    // userId로 크리에이터 조회
    const creator = await this.creatorService.findOneByUserIdOrFail(userId);

    // 크리에이터 상세 정보 조회 (플랫폼 + 사용자 정보 포함)
    return await this.creatorService.getDetailById(creator.id);
  }

  /**
   * 크리에이터 대시보드 통계 조회
   * GET /creators/me/dashboard
   */
  @SwaggerApiOperation({
    summary: '크리에이터 대시보드 통계',
    description: '크리에이터의 총 콘텐츠 수, 총 조회수, 플랫폼 수 등을 조회합니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiOkResponse({
    status: 200,
    description: '대시보드 통계 조회 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터 정보를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get('me/dashboard')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @HttpCode(200)
  @Serialize({
    message: '대시보드 통계 조회 성공',
  })
  async getMyDashboardStats(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<{
    creator: CreatorDetailDto;
    stats: {
      totalContents: number;
      totalViews: number;
      totalLikes: number;
      platformCount: number;
    };
  }> {
    // userId로 크리에이터 조회
    const creator = await this.creatorService.findOneByUserIdOrFail(userId);

    // 크리에이터 상세 정보 및 통계 조회
    const [creatorDetail, stats] = await Promise.all([
      this.creatorService.getDetailById(creator.id),
      this.creatorService.getDashboardStats(creator.id),
    ]);

    return {
      creator: creatorDetail,
      stats,
    };
  }
}
