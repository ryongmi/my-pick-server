import { Controller, Get, Query, Param, HttpCode, UseGuards } from '@nestjs/common';

import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { Serialize } from '@krgeobuk/core/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';

import { CreatorService } from '../services/creator.service.js';
import { CreatorPlatformService } from '../services/creator-platform.service.js';
import { CreatorSearchQueryDto, CreatorSearchResultDto, CreatorDetailDto } from '../dto/index.js';
import { CreatorPlatformEntity } from '../entities/creator-platform.entity.js';

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
}
