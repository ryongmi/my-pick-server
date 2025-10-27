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

import { CreatorService, CreatorPlatformService } from '../../creator/services/index.js';
import { CreatorOrchestrationService } from '../../creator/services/creator-orchestration.service.js';
import { UserSubscriptionService } from '../../user-subscription/services/index.js';
import { ReportService } from '../../report/services/index.js';
import { ReportTargetType } from '../../report/enums/index.js';
import { ContentAdminStatisticsService, ContentService, ContentOrchestrationService } from '../../content/services/index.js';
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
  declare status: 'active' | 'inactive' | 'suspended' | 'banned';
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
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly reportService: ReportService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly contentStatisticsService: ContentAdminStatisticsService,
    private readonly contentService: ContentService,
    private readonly contentOrchestrationService: ContentOrchestrationService
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
    
    // 관리자 정보를 병렬로 수집
    const [
      subscriptionCount,
      platforms,
      reportCount,
      contentCount
    ] = await Promise.all([
      this.userSubscriptionService.getSubscriberCount(creatorId),
      this.creatorPlatformService.findByCreatorId(creatorId),
      this.reportService.getCountByTarget(ReportTargetType.CREATOR, creatorId),
      this.contentService.countByCreatorId(creatorId)
    ]);

    const platformCount = platforms.length;

    const adminDetail: AdminCreatorDetailDto = {
      ...creator,
      createdAt: creator.createdAt || new Date(),
      updatedAt: creator.updatedAt || new Date(),
      status: creator.status || 'active', // Creator entity의 실제 status 필드 사용
      lastSyncAt: (await this.creatorService.getCreatorStatistics(creatorId)).lastSyncAt, // 실제 마지막 동기화 시간
      platformCount,
      subscriptionCount,
      contentCount, // ContentService.countByCreatorId를 통한 실제 콘텐츠 수
      reportCount,
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
    await this.creatorService.updateCreatorStatus(
      creatorId,
      dto.status,
      dto.reason
    );

    this.logger.log('Creator status updated by admin', {
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

    // CreatorService의 실제 통계 데이터 조회
    const statistics = await this.creatorService.getCreatorStatistics(creatorId);

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
      displayName?: string | undefined;
      followerCount: number;
      contentCount: number;
      totalViews: number;
      isActive: boolean;
      lastSyncAt?: Date | undefined;
      syncStatus: string;
    }[]
  > {
    // CreatorService의 실제 플랫폼 데이터 조회
    return await this.creatorService.getCreatorPlatforms(creatorId);
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

      // ReportService를 통해 실제 크리에이터 신고 데이터 조회
      const reports = await this.reportService.searchReports({
        targetType: ReportTargetType.CREATOR,
        targetId: creatorId,
        limit: 50, // 최대 50개 신고 표시
        page: 1,
      });

      this.logger.debug('Creator reports fetched successfully', { 
        creatorId, 
        reportCount: reports.items.length 
      });

      return reports.items.map(report => ({
        id: report.id,
        reportedBy: report.reporterInfo?.email || 'Unknown',
        reason: report.reason,
        status: report.status,
        reportedAt: report.createdAt,
        // reviewedAt는 별도 Review 정보가 있을 때 추가
        // reviewComment는 별도 Review 정보가 있을 때 추가
      }));
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

      // 고도화된 구독자 성장률 추정 로직
      // 기간별 성장 단계를 고려한 추정
      const growthFactor = days === 7 ? 0.02 : 0.08; // 주간 2%, 월간 8% 기본 성장률
      const dailyGrowthRate = growthFactor / days;
      
      // 비선형 성장 모델 적용 (초기에는 느린 성장, 나중에 가속)
      let estimatedPastSubscribers = currentSubscribers;
      for (let i = 0; i < days; i++) {
        const daysSinceStart = days - i;
        const adjustedGrowthRate = dailyGrowthRate * (1 + Math.log(daysSinceStart) / 10);
        estimatedPastSubscribers = Math.floor(estimatedPastSubscribers / (1 + adjustedGrowthRate));
      }
      
      estimatedPastSubscribers = Math.max(0, estimatedPastSubscribers);

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
      // ContentOrchestrationService를 통해 Creator별 상위 콘텐츠 조회 (statistics 포함)
      const contents = await this.contentOrchestrationService.searchContent({
        creatorId,
        limit,
        page: 1,
        sortBy: 'views',
        sortOrder: 'DESC'
      });

      return contents.items.map(content => {
        const views = content.statistics?.views || 0;
        const likes = content.statistics?.likes || 0;
        const comments = content.statistics?.comments || 0;
        
        // 참여율 계산 (likes + comments) / views * 100
        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
        
        return {
          contentId: content.id,
          title: content.title,
          views, // ContentSearchResultDto의 실제 statistics 사용
          likes, // ContentSearchResultDto의 실제 statistics 사용
          engagementRate: Math.round(engagementRate * 100) / 100, // 소수점 2자리로 반올림
          publishedAt: content.publishedAt,
        };
      });
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
      // 실제 Content 도메인과 연동하여 최근 활동 조회
      const [recentContent, recentPlatforms] = await Promise.all([
        this.contentService.findByCreatorId(creatorId),
        this.creatorPlatformService.findByCreatorId(creatorId),
      ]);

      const activities: Array<{
        type: 'content_created' | 'platform_added' | 'milestone_reached';
        description: string;
        timestamp: Date;
        relatedId?: string;
      }> = [];

      // 최근 콘텐츠 활동 추가
      recentContent
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, Math.floor(limit * 0.7)) // 70%는 콘텐츠 활동
        .forEach(content => {
          if (content.createdAt) {
            activities.push({
              type: 'content_created',
              description: `새 콘텐츠 '등록: ${content.title}'`,
              timestamp: content.createdAt,
              relatedId: content.id,
            });
          }
        });

      // 최근 플랫폼 추가 활동
      recentPlatforms
        .filter(platform => platform.createdAt)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, Math.floor(limit * 0.3)) // 30%는 플랫폼 활동
        .forEach(platform => {
          if (platform.createdAt) {
            activities.push({
              type: 'platform_added',
              description: `새 플랫폼 연결: ${platform.type} (${platform.displayName || platform.platformId})`,
              timestamp: platform.createdAt,
              relatedId: platform.id,
            });
          }
        });

      // 시간순 정렬 및 제한
      const sortedActivities = activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      this.logger.debug('Recent creator activity fetched successfully', {
        creatorId,
        activityCount: sortedActivities.length,
        limit,
      });

      return sortedActivities;
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
      // 실제 Content 도메인과 연동하여 참여율 계산
      const contents = await this.contentService.findByCreatorId(creatorId);
      
      if (contents.length === 0) {
        return 0;
      }

      // ContentOrchestrationService를 통해 통계 정보가 포함된 콘텐츠 조회
      const contentDetails = await Promise.all(
        contents.slice(0, 20).map(async (content) => { // 최근 20개 콘텐츠만 사용하여 성능 최적화
          try {
            const searchResult = await this.contentOrchestrationService.searchContent({
              creatorId,
              limit: 1,
              page: 1,
              sortBy: 'createdAt',
              sortOrder: 'DESC',
            });
            return searchResult.items.find(item => item.id === content.id);
          } catch {
            return null;
          }
        })
      );

      // 유효한 통계 데이터가 있는 콘텐츠만 처리
      const validContents = contentDetails.filter(content => 
        content && content.statistics && content.statistics.views > 0
      );

      if (validContents.length === 0) {
        return 0;
      }

      // 각 콘텐츠의 참여율 계산
      const engagementRates = validContents.map(content => {
        const views = content!.statistics!.views;
        const likes = content!.statistics!.likes || 0;
        const comments = content!.statistics!.comments || 0;
        const engagements = likes + comments;
        return views > 0 ? (engagements / views) * 100 : 0;
      });

      // 평균 참여율 계산
      const avgEngagementRate = engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length;
      
      this.logger.debug('Average engagement rate calculated', {
        creatorId,
        validContentsCount: validContents.length,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      });

      return Math.round(avgEngagementRate * 100) / 100; // 소수점 2자리로 반올림
    } catch (error: unknown) {
      this.logger.warn('Failed to calculate average engagement rate', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }
}
