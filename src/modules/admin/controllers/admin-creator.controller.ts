import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';

import { EntityManager } from 'typeorm';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiOkResponse,
  // SwaggerApiCreatedResponse,
  // SwaggerApiNoContentResponse,
  SwaggerApiPaginatedResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { PlatformType } from '@common/enums/index.js';

import { CreatorService } from '../../creator/services/index.js';
import { CreatorOrchestrationService } from '../../creator/services/creator-orchestration.service.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
} from '../../creator/dto/index.js';
import { ConsentType } from '../../creator/entities/index.js';

// 관리자 전용 크리에이터 상태 DTO
export class UpdateCreatorStatusDto {
  status!: 'active' | 'inactive' | 'suspended';
  reason?: string;
}

// 관리자 전용 크리에이터 상세 DTO (추가 정보 포함)
export class AdminCreatorDetailDto extends CreatorDetailDto {
  declare createdAt: Date;
  declare updatedAt: Date;
  declare status: 'active' | 'inactive' | 'suspended';
  lastSyncAt?: Date | undefined;
  platformCount!: number;
  subscriptionCount!: number;
  declare contentCount: number;
  reportCount!: number;
}

@SwaggerApiTags({ tags: ['admin-creators'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
@Controller('admin/creators')
export class AdminCreatorController {
  private readonly logger = new Logger(AdminCreatorController.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly orchestrationService: CreatorOrchestrationService,
    private readonly userSubscriptionService: UserSubscriptionService
  ) {}

  @Get()
  @SwaggerApiOperation({
    summary: '관리자용 크리에이터 목록 조회',
    description:
      '관리자가 모든 크리에이터 목록을 조회합니다. 검색, 필터링, 페이지네이션을 지원합니다.',
  })
  @SwaggerApiPaginatedResponse({
    dto: CreatorSearchResultDto,
    status: 200,
    description: '크리에이터 목록 조회 성공',
  })
  @RequirePermission('creator:read')
  async getCreators(
    @Query() query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return await this.creatorService.searchCreators(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({
    summary: '관리자용 크리에이터 완전 생성 (플랫폼, 동의 포함)',
    description:
      '관리자가 크리에이터를 생성하고 플랫폼 및 동의 정보를 함께 설정합니다. 트랜잭션을 통해 안전하게 처리됩니다.',
  })
  @SwaggerApiOkResponse({ status: 201, description: '크리에이터 생성 완료' })
  @RequirePermission('creator:write')
  async createCreatorComplete(
    @Body() body: {
      creator: CreateCreatorDto;
      platforms?: { type: PlatformType; platformId: string; url?: string; displayName?: string; }[];
      consents?: ConsentType[];
    },
    @TransactionManager() transactionManager: EntityManager
  ): Promise<{ creatorId: string }> {
    const { creator, platforms = [], consents = [] } = body;
    const creatorId = await this.orchestrationService.createCreatorWithPlatforms(
      creator,
      platforms,
      consents,
      transactionManager
    );
    return { creatorId };
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '관리자용 크리에이터 상세 조회',
    description:
      '관리자가 크리에이터의 상세 정보를 조회합니다. 일반 사용자 조회와 달리 관리용 추가 정보를 포함합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    dto: AdminCreatorDetailDto,
    status: 200,
    description: '크리에이터 상세 조회 성공',
  })
  @RequirePermission('creator:read')
  async getCreatorById(
    @Param('id', ParseUUIDPipe) creatorId: string
  ): Promise<AdminCreatorDetailDto> {
    // 관리자는 모든 정보를 볼 수 있음 (userId 없이 조회)
    const creator = await this.creatorService.getCreatorById(creatorId);
    const subscriptionCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    // TODO: 추가 관리자 정보 수집
    const adminDetail: AdminCreatorDetailDto = {
      ...creator,
      createdAt: new Date(), // TODO: 실제 생성일
      updatedAt: new Date(), // TODO: 실제 수정일
      status: 'active', // TODO: 실제 상태
      lastSyncAt: undefined, // TODO: 마지막 동기화 시간
      platformCount: 0, // TODO: platform 정보 조회 로직 구현
      subscriptionCount,
      contentCount: 0, // TODO: Content에서 개수 계산
      reportCount: 0, // TODO: 신고 수
    };

    return adminDetail;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '관리자용 크리에이터 정보 수정' })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({ dto: UpdateCreatorDto })
  @SwaggerApiOkResponse({ status: 204, description: '크리에이터 수정 완료' })
  @RequirePermission('creator:write')
  async updateCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: UpdateCreatorDto
  ): Promise<void> {
    await this.creatorService.updateCreator(creatorId, dto);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '크리에이터 상태 변경',
    description:
      '관리자가 크리에이터의 상태를 변경합니다 (활성/비활성/정지). 관리자 전용 기능입니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiBody({ dto: UpdateCreatorStatusDto })
  @SwaggerApiOkResponse({ status: 204, description: '상태 변경 완료' })
  @RequirePermission('creator:write')
  async updateCreatorStatus(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: UpdateCreatorStatusDto
  ): Promise<void> {
    // TODO: 크리에이터 상태 변경 로직 구현
    // 현재는 CreatorEntity에 status 필드가 없으므로 나중에 구현

    // 상태 변경 로그
    this.logger.log('Creator status updated', {
      creatorId,
      newStatus: dto.status,
      reason: dto.reason,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({
    summary: '관리자용 크리에이터 완전 삭제',
    description: '크리에이터와 관련된 모든 데이터(플랫폼, 동의, 통계 등)를 안전하게 삭제합니다.'
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ status: 204, description: '크리에이터 삭제 완료' })
  @RequirePermission('creator:delete')
  async deleteCreatorComplete(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    await this.orchestrationService.deleteCreatorComplete(creatorId, transactionManager);
  }

  @Get(':id/statistics')
  @SwaggerApiOperation({
    summary: '크리에이터 상세 통계 (관리자용)',
    description:
      '관리자가 크리에이터의 상세한 통계 정보를 조회합니다. 일반 통계보다 더 많은 정보를 포함합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 통계 조회 성공',
  })
  @RequirePermission('creator:read')
  async getCreatorStatistics(@Param('id', ParseUUIDPipe) creatorId: string): Promise<{
    subscriberCount: number;
    followerCount: number;
    contentCount: number;
    totalViews: number;
    avgEngagementRate: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
    topContent: unknown[];
    recentActivity: unknown[];
  }> {
    await this.creatorService.findByIdOrFail(creatorId);
    const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    // TODO: CreatorService에 getCreatorStatistics 메서드 구현 후 사용
    const statistics = { followerCount: 0, contentCount: 0, totalViews: 0 };

    // 성장률 계산 (주간/월간)
    const [weeklyGrowth, monthlyGrowth] = await Promise.all([
      this.calculateGrowthRate(creatorId, 7),
      this.calculateGrowthRate(creatorId, 30),
    ]);

    // 인기 콘텐츠 및 최근 활동 조회
    const [topContent, recentActivity, avgEngagementRate] = await Promise.all([
      this.getTopContentByCreator(creatorId, 5),
      this.getRecentActivityByCreator(creatorId, 10),
      this.calculateAvgEngagementRate(creatorId),
    ]);

    return {
      subscriberCount,
      followerCount: statistics.followerCount,
      contentCount: statistics.contentCount,
      totalViews: statistics.totalViews,
      avgEngagementRate,
      weeklyGrowth,
      monthlyGrowth,
      topContent,
      recentActivity,
    };
  }

  @Get(':id/platforms')
  @SwaggerApiOperation({
    summary: '크리에이터 플랫폼 목록 (관리자용)',
    description: '관리자가 크리에이터가 연결한 모든 플랫폼 목록과 동기화 상태를 조회합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 플랫폼 목록 조회 성공',
  })
  @RequirePermission('creator:read')
  async getCreatorPlatforms(@Param('id', ParseUUIDPipe) creatorId: string): Promise<
    {
      id: string;
      type: string;
      platformId: string;
      url: string;
      displayName?: string;
      followerCount: number;
      contentCount: number;
      totalViews: number;
      isActive: boolean;
      lastSyncAt?: Date | undefined;
      syncStatus: string;
    }[]
  > {
    // TODO: CreatorService에 getCreatorPlatforms 메서드 구현 후 사용
    await this.creatorService.findByIdOrFail(creatorId);
    return [];
  }

  @Get(':id/reports')
  @SwaggerApiOperation({
    summary: '크리에이터 신고 목록 (관리자용)',
    description:
      '관리자가 특정 크리에이터에 대한 모든 신고 내역을 조회합니다. 신고 처리 상태도 함께 확인할 수 있습니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신고 이력 조회 성공',
  })
  @RequirePermission('creator:read')
  async getCreatorReports(@Param('id', ParseUUIDPipe) creatorId: string): Promise<
    Array<{
      id: string;
      reportedBy: string;
      reason: string;
      status: string;
      reportedAt: Date;
      reviewedAt?: Date;
      reviewComment?: string;
    }>
  > {
    try {
      // 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(creatorId);

      // TODO: report 모듈 구현 후 실제 신고 데이터 조회
      this.logger.debug('Report module not implemented yet', { creatorId });

      return [];
    } catch (error: unknown) {
      this.logger.error('Failed to get creator reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      if (error instanceof Error && error.message.includes('not found')) {
        throw error; // CreatorException.creatorNotFound()
      }

      return [];
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async calculateGrowthRate(creatorId: string, days: number): Promise<number> {
    try {
      // 현재 구독자 수
      const currentSubscribers = await this.userSubscriptionService.getSubscriberCount(creatorId);

      // N일 전 구독자 수 (간단한 추정 - 실제로는 히스토리 테이블 필요)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - days);

      // TODO: 실제로는 구독자 히스토리 테이블에서 과거 데이터 조회
      // 임시로 현재 구독자 수에서 랜덤 감소값으로 추정
      const estimatedPastSubscribers = Math.max(
        0,
        currentSubscribers - Math.floor(Math.random() * currentSubscribers * 0.1)
      );

      if (estimatedPastSubscribers === 0) return 0;

      const growthRate =
        ((currentSubscribers - estimatedPastSubscribers) / estimatedPastSubscribers) * 100;
      return Math.round(growthRate * 100) / 100; // 소수점 2자리
    } catch (error: unknown) {
      this.logger.warn('Failed to calculate growth rate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        days,
      });
      return 0;
    }
  }

  private async getTopContentByCreator(
    creatorId: string,
    limit: number
  ): Promise<
    Array<{
      contentId: string;
      title: string;
      views: number;
      likes: number;
      engagementRate: number;
      publishedAt: Date;
    }>
  > {
    try {
      // TODO: content 모듈 구현 후 실제 콘텐츠 데이터 조회
      this.logger.debug('Content module not implemented yet', { creatorId, limit });
      return [];
    } catch (error: unknown) {
      this.logger.warn('Failed to get top content by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        limit,
      });
      return [];
    }
  }

  private async getRecentActivityByCreator(
    creatorId: string,
    limit: number
  ): Promise<
    Array<{
      type: 'content_created' | 'platform_added' | 'milestone_reached';
      description: string;
      timestamp: Date;
      relatedId?: string;
    }>
  > {
    try {
      // TODO: content 모듈 구현 후 실제 콘텐츠 활동 데이터 조회
      this.logger.debug('Content module not implemented yet', { creatorId, limit });
      return [];
    } catch (error: unknown) {
      this.logger.warn('Failed to get recent activity by creator', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        limit,
      });
      return [];
    }
  }

  private async calculateAvgEngagementRate(creatorId: string): Promise<number> {
    try {
      // TODO: content 모듈 구현 후 실제 참여율 계산
      this.logger.debug('Content module not implemented yet', { creatorId });
      return 0;
    } catch (error: unknown) {
      this.logger.warn('Failed to calculate average engagement rate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }
}
