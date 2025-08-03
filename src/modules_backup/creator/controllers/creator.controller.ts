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
  Logger,
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
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorService, CreatorPlatformService, CreatorConsentService } from '../services/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreatorStatsDto,
  CreatorPlatformDto,
  CreateCreatorDto,
  UpdateCreatorDto,
  AddPlatformDto,
  UpdatePlatformDto,
  GrantConsentDto,
  ConsentHistoryDto,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['creators'] })
@Controller('creators')
export class CreatorController {
  private readonly logger = new Logger(CreatorController.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly creatorConsentService: CreatorConsentService
  ) {}

  @Get()
  @SwaggerApiOperation({ summary: '크리에이터 목록 조회 (공개)' })
  @SwaggerApiPaginatedResponse({ dto: CreatorSearchResultDto, status: 200, description: '크리에이터 목록 조회 성공' })
  async getCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    this.logger.debug('Creator search request', {
      hasNameFilter: !!query.name,
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    try {
      // 1. Creator 검색
      const creators = await this.creatorService.searchCreators(query);
      
      if (creators.items.length === 0) {
        this.logger.debug('No creators found for search query', {
          category: query.category,
          name: query.name,
        });
        return { 
          items: [], 
          pageInfo: creators.pageInfo 
        };
      }

      // 2. 배치로 플랫폼 정보 조회 (N+1 문제 해결)
      const creatorIds = creators.items.map((creator) => creator.id!);
      const platforms = await this.creatorPlatformService.findByCreatorIds(creatorIds);

      // 3. 메모리에서 조합하여 결과 구성
      const items = this.buildCreatorSearchResults(creators.items, platforms);

      this.logger.debug('Creator search completed', {
        foundCount: items.length,
        totalPlatforms: platforms.length,
      });

      return {
        items,
        pageInfo: creators.pageInfo,
      };
    } catch (error: unknown) {
      this.logger.error('Creator search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query,
      });
      throw error;
    }
  }

  @Get(':id')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 상세 조회 (로그인 필요)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorDetailDto, status: 200, description: '크리에이터 상세 조회 성공' })
  @Serialize({ dto: CreatorDetailDto })
  async getCreatorById(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() jwt?: JwtPayload
  ): Promise<CreatorDetailDto> {
    // 병렬 조회로 성능 최적화
    const [creator, platforms] = await Promise.all([
      this.creatorService.findByIdOrFail(creatorId),
      this.creatorPlatformService.findByCreatorId(creatorId),
    ]);

    // 플랫폼별 데이터 실시간 집계
    const totalFollowerCount = platforms.reduce((sum, p) => sum + p.followerCount, 0);
    const totalContentCount = platforms.reduce((sum, p) => sum + p.contentCount, 0);
    const totalViews = platforms.reduce((sum, p) => sum + p.totalViews, 0);

    const detailDto: CreatorDetailDto = {
      id: creator.id,
      name: creator.name,
      displayName: creator.displayName,
      avatar: creator.avatar,
      description: creator.description,
      isVerified: creator.isVerified,
      category: creator.category,
      tags: creator.tags,
      followerCount: totalFollowerCount,
      contentCount: totalContentCount,
      totalViews: totalViews,
      platforms: platforms.map(p => ({
        id: p.id,
        type: p.type,
        platformId: p.platformId,
        url: p.url,
        displayName: p.displayName || '',
        followerCount: p.followerCount,
        contentCount: p.contentCount,
        totalViews: p.totalViews,
        isActive: p.isActive,
        lastSyncAt: p.lastSyncAt,
        syncStatus: p.syncStatus,
      })),
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };

    return detailDto;
  }

  @Get(':id/stats')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 통계 조회 (로그인 필요)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorStatsDto, status: 200, description: '크리에이터 통계 조회 성공' })
  @Serialize({ dto: CreatorStatsDto })
  async getCreatorStats(@Param('id', ParseUUIDPipe) creatorId: string): Promise<CreatorStatsDto> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);
    
    // 플랫폼별 통계 집계
    const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
    
    const followerCount = platforms.reduce((sum, p) => sum + p.followerCount, 0);
    const contentCount = platforms.reduce((sum, p) => sum + p.contentCount, 0);
    const totalViews = platforms.reduce((sum, p) => sum + p.totalViews, 0);

    return {
      subscriberCount: 0, // TODO: UserSubscriptionService 연동 후 구현
      followerCount,
      contentCount,
      totalViews,
    };
  }

  @Get(':id/platforms')
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 목록 조회 (공개)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ dto: CreatorPlatformDto, status: 200, description: '크리에이터 플랫폼 목록 조회 성공', isArray: true })
  @Serialize({ dto: CreatorPlatformDto })
  async getCreatorPlatforms(
    @Param('id', ParseUUIDPipe) creatorId: string
  ): Promise<CreatorPlatformDto[]> {
    // Creator 존재 확인
    await this.creatorService.findByIdOrFail(creatorId);

    // 플랫폼 목록 조회
    const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);

    return platforms.map((platform) => ({
      id: platform.id,
      type: platform.type,
      platformId: platform.platformId,
      url: platform.url,
      displayName: platform.displayName || '',
      followerCount: platform.followerCount,
      contentCount: platform.contentCount,
      totalViews: platform.totalViews,
      isActive: platform.isActive,
      lastSyncAt: platform.lastSyncAt,
      syncStatus: platform.syncStatus,
    }));
  }

  @Post()
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 생성 (관리자 전용)' })
  @SwaggerApiBody({ type: CreateCreatorDto })
  @SwaggerApiOkResponse({ status: 201, description: '크리에이터 생성 성공' })
  @HttpCode(HttpStatus.CREATED)
  async createCreator(
    @Body() dto: CreateCreatorDto,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean; creatorId: string }> {
    const creator = await this.creatorService.createCreator(dto);
    
    return {
      success: true,
      creatorId: creator.id,
    };
  }

  @Patch(':id')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 수정 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({ type: UpdateCreatorDto })
  @SwaggerApiOkResponse({ status: 200, description: '크리에이터 수정 성공' })
  async updateCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: UpdateCreatorDto,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    await this.creatorService.updateCreator(creatorId, dto);
    
    return { success: true };
  }

  @Delete(':id')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 삭제 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ status: 200, description: '크리에이터 삭제 성공' })
  async deleteCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    await this.creatorService.deleteCreator(creatorId);
    
    return { success: true };
  }

  @Post(':id/platforms')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터에 플랫폼 추가 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({ type: AddPlatformDto })
  @SwaggerApiOkResponse({ status: 201, description: '플랫폼 추가 성공' })
  @HttpCode(HttpStatus.CREATED)
  async addPlatformToCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: AddPlatformDto,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    await this.creatorPlatformService.addPlatformToCreator(creatorId, dto);
    
    return { success: true };
  }

  @Patch(':id/platforms/:platformId')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 수정 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'platformId', type: String, description: '플랫폼 ID' })
  @SwaggerApiBody({ type: UpdatePlatformDto })
  @SwaggerApiOkResponse({ status: 200, description: '플랫폼 수정 성공' })
  async updateCreatorPlatform(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @Body() dto: UpdatePlatformDto,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    // 플랫폼이 해당 크리에이터의 것인지 확인
    const platform = await this.creatorPlatformService.findByIdOrFail(platformId);
    if (platform.creatorId !== creatorId) {
      throw new Error('Platform does not belong to this creator');
    }

    await this.creatorPlatformService.updatePlatform(platformId, dto);
    
    return { success: true };
  }

  @Delete(':id/platforms/:platformId')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 플랫폼 삭제 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'platformId', type: String, description: '플랫폼 ID' })
  @SwaggerApiOkResponse({ status: 200, description: '플랫폼 삭제 성공' })
  async removeCreatorPlatform(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('platformId', ParseUUIDPipe) platformId: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    // 플랫폼이 해당 크리에이터의 것인지 확인
    const platform = await this.creatorPlatformService.findByIdOrFail(platformId);
    if (platform.creatorId !== creatorId) {
      throw new Error('Platform does not belong to this creator');
    }

    await this.creatorPlatformService.removePlatformFromCreator(platformId);
    
    return { success: true };
  }

  // ==================== CONSENT MANAGEMENT APIS ====================

  @Get(':id/consents')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 동의 목록 조회 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ status: 200, description: '동의 목록 조회 성공', isArray: true })
  async getCreatorConsents(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<string[]> {
    return await this.creatorConsentService.getActiveConsents(creatorId);
  }

  @Get(':id/consents/:type')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '특정 동의 타입 상태 확인 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'type', type: String, description: '동의 타입' })
  @SwaggerApiOkResponse({ status: 200, description: '동의 상태 확인 성공' })
  async checkConsentType(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ hasConsent: boolean }> {
    const hasConsent = await this.creatorConsentService.hasConsent(creatorId, type);
    return { hasConsent };
  }

  @Get(':id/consents/:type/history')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '동의 이력 조회 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'type', type: String, description: '동의 타입' })
  @SwaggerApiOkResponse({ dto: ConsentHistoryDto, status: 200, description: '동의 이력 조회 성공', isArray: true })
  @Serialize({ dto: ConsentHistoryDto })
  async getConsentHistory(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<ConsentHistoryDto[]> {
    const history = await this.creatorConsentService.getConsentHistory(creatorId, type);
    
    return history.map(consent => ({
      id: consent.id,
      type: consent.type,
      isGranted: consent.isGranted,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
      expiresAt: consent.expiresAt,
      version: consent.version,
      createdAt: consent.createdAt
    }));
  }

  @Post(':id/consents/:type')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '동의 생성 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'type', type: String, description: '동의 타입' })
  @SwaggerApiBody({ type: GrantConsentDto })
  @SwaggerApiOkResponse({ status: 201, description: '동의 생성 성공' })
  @HttpCode(HttpStatus.CREATED)
  async grantConsent(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: string,
    @Body() dto: GrantConsentDto,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    await this.creatorConsentService.grantConsent({
      creatorId,
      type,
      expiresAt: dto.expiresAt,
      consentData: dto.consentData,
      version: dto.version
    });
    
    return { success: true };
  }

  @Delete(':id/consents/:type')
  @SwaggerApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '동의 철회 (관리자 전용)' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiParam({ name: 'type', type: String, description: '동의 타입' })
  @SwaggerApiOkResponse({ status: 200, description: '동의 철회 성공' })
  async revokeConsent(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Param('type') type: string,
    @CurrentJwt() jwt: JwtPayload
  ): Promise<{ success: boolean }> {
    await this.creatorConsentService.revokeConsent(creatorId, type);
    return { success: true };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private buildCreatorSearchResults(
    creators: Partial<any>[],
    platforms: any[]
  ): CreatorSearchResultDto[] {
    return creators.map((creator) => {
      const creatorPlatforms = platforms.filter((p) => p.creatorId === creator.id);

      // 플랫폼별 데이터 실시간 집계
      const totalFollowerCount = creatorPlatforms.reduce((sum, p) => sum + p.followerCount, 0);
      const totalContentCount = creatorPlatforms.reduce((sum, p) => sum + p.contentCount, 0);
      const totalViews = creatorPlatforms.reduce((sum, p) => sum + p.totalViews, 0);

      return {
        id: creator.id!,
        name: creator.name!,
        displayName: creator.displayName!,
        avatar: creator.avatar || '',
        description: creator.description,
        isVerified: creator.isVerified!,
        followerCount: totalFollowerCount,
        subscriberCount: 0, // TODO: UserSubscriptionService 연동 후 구현
        contentCount: totalContentCount,
        totalViews: totalViews,
        category: creator.category!,
        tags: creator.tags,
        platforms: creatorPlatforms.map((p) => ({
          id: p.id,
          type: p.type,
          platformId: p.platformId,
          url: p.url,
          followerCount: p.followerCount,
          contentCount: p.contentCount,
          totalViews: p.totalViews,
          isActive: p.isActive,
        })),
        createdAt: creator.createdAt!,
      };
    });
  }
}