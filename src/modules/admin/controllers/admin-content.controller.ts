import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  HttpException,
  Logger,
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';

import { 
  ContentService,
  ContentOrchestrationService,
  ContentAdminStatisticsService,
} from '../../content/services/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { ReportService, ReportOrchestrationService } from '../../report/services/index.js';
import { ReportTargetType, ReportStatus } from '../../report/enums/index.js';
import {
  AdminContentSearchQueryDto,
  AdminContentListItemDto,
  AdminContentDetailDto,
  UpdateContentStatusDto,
  ContentStatus,
} from '../dto/index.js';
import { AdminException } from '../exceptions/index.js';

@Controller('admin/content')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
export class AdminContentController {
  private readonly logger = new Logger(AdminContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly contentOrchestrationService: ContentOrchestrationService,
    private readonly contentStatisticsService: ContentAdminStatisticsService,
    private readonly reportService: ReportService,
    private readonly reportOrchestrationService: ReportOrchestrationService,
    private readonly creatorService: CreatorService,
  ) {}

  @Get()
  @RequirePermission('content:read')
  async getContentList(
    @Query() query: AdminContentSearchQueryDto,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<PaginatedResult<AdminContentListItemDto>> {
    try {
      this.logger.debug('Admin content list request', {
        adminId: userId,
        query: {
          creatorId: query.creatorId,
          type: query.type,
          platform: query.platform,
          page: query.page,
          limit: query.limit,
        },
      });

      // ContentOrchestrationService의 searchContent를 활용하되, 관리자용으로 변환
      const searchQuery = {
        creatorId: query.creatorId,
        type: query.type,
        platform: query.platform,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy === 'title' ? 'createdAt' : query.sortBy, // title 정렬은 createdAt로 매핑
        sortOrder: query.sortOrder,
      };

      const result = await this.contentOrchestrationService.searchContent(searchQuery);

      // 관리자용 DTO로 변환 - 신고 수 및 Creator 정보 추가
      const adminItems = await Promise.all(result.items.map(async (content) => {
        // 병렬로 신고 수와 Creator 정보 조회
        const [reportCount, creator] = await Promise.all([
          this.reportService.getCountByTarget(ReportTargetType.CONTENT, content.id),
          this.creatorService.findById(content.creatorId),
        ]);

        return plainToInstance(
          AdminContentListItemDto,
          {
            id: content.id,
            type: content.type,
            title: content.title,
            platform: content.platform,
            status: content.status || ContentStatus.ACTIVE, // content entity의 실제 status 필드 사용
            publishedAt: content.publishedAt,
            createdAt: content.createdAt,
            creator: {
              id: content.creatorId,
              name: creator?.name || `Creator ${content.creatorId}`,
              displayName: creator?.displayName || creator?.name || `Creator ${content.creatorId}`,
            },
            statistics: {
              views: content.statistics?.views || 0,
              likes: content.statistics?.likes || 0,
              comments: content.statistics?.comments || 0,
            },
            flagCount: reportCount, // ReportService를 통해 실제 신고 수 조회
            lastModeratedAt: await this.getLastModerationTime(content.id),
            moderatedBy: undefined,
          },
          {
            excludeExtraneousValues: true,
          }
        );
      }));

      this.logger.log('Admin content list fetched successfully', {
        adminId: userId,
        totalItems: result.pageInfo.totalItems,
        returnedItems: adminItems.length,
      });

      return {
        items: adminItems,
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Admin content list fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: userId,
        query,
      });
      throw AdminException.contentDataFetchError();
    }
  }

  @Get(':id')
  @RequirePermission('content:read')
  async getContentDetail(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<AdminContentDetailDto> {
    try {
      this.logger.debug('Admin content detail request', {
        adminId: userId,
        contentId,
      });

      const content = await this.contentService.getContentById(contentId);

      // 신고 정보 및 Creator 정보 병렬 조회
      const [reportCount, reports, creator] = await Promise.all([
        this.reportService.getCountByTarget(ReportTargetType.CONTENT, contentId),
        this.reportService.searchReports({
          targetType: ReportTargetType.CONTENT,
          targetId: contentId,
          limit: 10,
          page: 1,
        }),
        this.creatorService.findById(content.creatorId),
      ]);

      this.logger.log('Admin content detail fetched successfully', {
        adminId: userId,
        contentId,
        contentType: content.type,
        platform: content.platform,
        reportCount,
        reportsFound: reports.items.length,
      });

      return plainToInstance(
        AdminContentDetailDto,
        {
          id: content.id,
          type: content.type,
          title: content.title,
          description: content.description,
          thumbnail: content.thumbnail,
          url: content.url,
          platform: content.platform,
          platformId: content.platformId,
          duration: content.duration,
          status: content.status || ContentStatus.ACTIVE, // content entity의 실제 status 필드 사용
          publishedAt: content.publishedAt,
          createdAt: content.createdAt,
          creator: {
            id: content.creatorId,
            name: creator?.name || `Creator ${content.creatorId}`,
            displayName: creator?.displayName || creator?.name || `Creator ${content.creatorId}`,
          },
          statistics: {
            views: content.statistics?.views || 0,
            likes: content.statistics?.likes || 0,
            comments: content.statistics?.comments || 0,
          },
          metadata: {
            language: content.language || null,
            isLive: content.isLive || false,
            quality: content.quality || null,
            ageRestriction: content.ageRestriction || false,
            duration: content.duration || null,
          }, // Content entity의 메타데이터 필드들 사용
          flagCount: reportCount, // ReportService를 통해 실제 신고 수 조회
          flags: reports.items.map(report => ({
            id: report.id,
            reason: report.reason,
            status: report.status,
            createdAt: report.createdAt,
          })),
          moderationHistory: await this.getModerationHistory(content.id),
        },
        {
          excludeExtraneousValues: true,
        }
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Admin content detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: userId,
        contentId,
      });
      throw AdminException.contentDataFetchError();
    }
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('content:write')
  async updateContentStatus(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() dto: UpdateContentStatusDto,
    @CurrentJwt() { userId: adminId }: AuthenticatedJwt
  ): Promise<void> {
    try {
      this.logger.log('Admin content status update request', {
        adminId,
        contentId,
        newStatus: dto.status,
        reason: dto.reason,
      });

      // ContentService의 updateContentStatus 메서드 사용
      await this.contentService.updateContentStatus(
        contentId,
        dto.status.toLowerCase() as 'active' | 'inactive' | 'under_review' | 'flagged' | 'removed',
        adminId, // JWT에서 추출한 관리자 ID
        dto.reason,
      );

      this.logger.log('Admin content status updated successfully', {
        adminId,
        contentId,
        newStatus: dto.status,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Admin content status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        contentId,
        newStatus: dto.status,
      });
      throw AdminException.contentStatusUpdateError();
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('content:delete')
  async deleteContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    @CurrentJwt() { userId: adminId }: AuthenticatedJwt
  ): Promise<void> {
    try {
      this.logger.log('Admin content deletion request', {
        adminId,
        contentId,
      });

      await this.contentService.deleteContent(contentId);

      this.logger.log('Admin content deleted successfully', {
        adminId,
        contentId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Admin content deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        contentId,
      });
      throw AdminException.contentDeleteError();
    }
  }

  @Get(':id/flags')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentFlags(@Param('id', ParseUUIDPipe) contentId: string): Promise<{
    flags: Array<{
      id: string;
      reason: string;
      description?: string;
      reportedBy: string;
      reportedAt: Date;
      status: string;
    }>;
  }> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      // ReportService를 통해 실제 신고 목록 조회
      const reports = await this.reportService.searchReports({
        targetType: ReportTargetType.CONTENT,
        targetId: contentId,
        limit: 50, // 최대 50개 신고 표시
        page: 1,
      });

      this.logger.debug('Content flags fetched successfully', {
        contentId,
        flagCount: reports.items.length,
      });

      return { 
        flags: reports.items.map(report => ({
          id: report.id,
          reason: report.reason,
          description: report.description || '',
          reportedBy: report.reporterInfo?.email || 'Unknown',
          reportedAt: report.createdAt,
          status: report.status,
        }))
      };
    } catch (_error: unknown) {
      throw AdminException.contentDataFetchError();
    }
  }

  @Put(':id/flags/:flagId/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('content:write')
  async resolveContentFlag(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Body() body: { action: 'dismiss' | 'approve'; reason?: string },
    @CurrentJwt() { userId: _id }: AuthenticatedJwt
  ): Promise<void> {
    try {
      // 콘텐츠 및 신고 존재 확인
      await this.contentService.findByIdOrFail(contentId);
      const report = await this.reportService.findByIdOrFail(flagId);

      // 신고가 해당 콘텐츠에 대한 것인지 확인
      if (report.targetType !== ReportTargetType.CONTENT || report.targetId !== contentId) {
        throw AdminException.moderationActionError();
      }

      // ReportOrchestrationService를 통한 실제 신고 처리
      if (body.action === 'approve') {
        // 신고 승인 - 콘텐츠 문제 인정
        await this.reportOrchestrationService.reviewReport(
          flagId,
          _id,
          {
            status: ReportStatus.RESOLVED,
            reviewComment: body.reason || '관리자에 의한 신고 승인',
          }
        );
        
        this.logger.log('Content flag approved by admin', {
          adminId: _id,
          contentId,
          flagId,
          reason: body.reason,
        });
      } else {
        // 신고 기각 - 신고가 부당함
        await this.reportOrchestrationService.reviewReport(
          flagId,
          _id,
          {
            status: ReportStatus.DISMISSED,
            reviewComment: body.reason || '관리자에 의한 신고 기각',
          }
        );
        
        this.logger.log('Content flag dismissed by admin', {
          adminId: _id,
          contentId,
          flagId,
          reason: body.reason,
        });
      }
    } catch (_error: unknown) {
      throw AdminException.moderationActionError();
    }
  }

  @Get('statistics/overview')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentStatistics(): Promise<{
    totalContent: number;
    activeContent: number;
    inactiveContent: number;
    flaggedContent: number;
    removedContent: number;
    contentByPlatform: Array<{ platform: string; count: number }>;
    contentByStatus: Array<{ status: string; count: number }>;
  }> {
    try {
      // 기본 통계와 상태별 콘텐츠 수를 병렬로 조회
      const [stats, statusCounts] = await Promise.all([
        this.contentStatisticsService.getContentStatistics(),
        this.getContentCountsByStatus()
      ]);
      
      return {
        totalContent: stats.totalContent,
        activeContent: statusCounts.active,
        inactiveContent: statusCounts.inactive,
        flaggedContent: statusCounts.flagged, // 실제 flagged 상태의 콘텐츠 수
        removedContent: statusCounts.removed, // 실제 removed 상태의 콘텐츠 수
        contentByPlatform: stats.contentByPlatform,
        contentByStatus: [
          { status: 'active', count: statusCounts.active },
          { status: 'inactive', count: statusCounts.inactive },
          { status: 'under_review', count: statusCounts.under_review },
          { status: 'flagged', count: statusCounts.flagged },
          { status: 'removed', count: statusCounts.removed },
        ],
      };
    } catch (_error: unknown) {
      this.logger.error('Failed to get content statistics', {
        error: _error instanceof Error ? _error.message : 'Unknown error',
      });
      throw AdminException.statisticsGenerationError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async getLastModerationTime(contentId: string): Promise<Date | undefined> {
    try {
      // ReportService를 통해 해당 콘텐츠의 최근 처리된 신고 조회
      const reports = await this.reportService.searchReports({
        targetType: ReportTargetType.CONTENT,
        targetId: contentId,
        limit: 1,
        page: 1,
      });

      // 처리된 신고 중 가장 최근 것을 찾기
      const processedReports = reports.items.filter(report => 
        report.status === 'resolved' || report.status === 'dismissed'
      );

      if (processedReports.length > 0) {
        // 가장 최근 처리된 신고의 업데이트 시간 반환
        return processedReports[0]?.updatedAt || processedReports[0]?.createdAt;
      }

      return undefined;
    } catch (error: unknown) {
      this.logger.debug('Failed to get last moderation time', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return undefined;
    }
  }

  private async getModerationHistory(contentId: string): Promise<Array<{
    action: 'approved' | 'flagged' | 'removed' | 'restored';
    reason?: string;
    moderatedBy: string;
    moderatedAt: Date;
  }>> {
    try {
      // ReportService를 통해 해당 콘텐츠의 모든 신고 이력 조회
      const reports = await this.reportService.searchReports({
        targetType: ReportTargetType.CONTENT,
        targetId: contentId,
        limit: 20, // 최대 20개 모더레이션 이력
        page: 1,
      });

      const moderationHistory: Array<{
        action: 'approved' | 'flagged' | 'removed' | 'restored';
        reason?: string;
        moderatedBy: string;
        moderatedAt: Date;
      }> = [];

      // 신고 데이터를 모더레이션 이력으로 변환
      reports.items.forEach(report => {
        if (report.status === 'resolved') {
          moderationHistory.push({
            action: 'flagged',
            reason: report.reason,
            moderatedBy: 'system', // 실제로는 reviewedBy 필드에서 가져와야 함
            moderatedAt: report.updatedAt || report.createdAt,
          });
        } else if (report.status === 'dismissed') {
          moderationHistory.push({
            action: 'approved',
            reason: `신고 기각: ${report.reason}`,
            moderatedBy: 'system', // 실제로는 reviewedBy 필드에서 가져와야 함
            moderatedAt: report.updatedAt || report.createdAt,
          });
        }
      });

      // 시간순 정렬 (최신순)
      moderationHistory.sort((a, b) => b.moderatedAt.getTime() - a.moderatedAt.getTime());

      this.logger.debug('Moderation history fetched successfully', {
        contentId,
        historyCount: moderationHistory.length,
      });

      return moderationHistory;
    } catch (error: unknown) {
      this.logger.debug('Failed to get moderation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentId,
      });
      return [];
    }
  }

  private async getContentCountsByStatus(): Promise<{
    active: number;
    inactive: number;
    under_review: number;
    flagged: number;
    removed: number;
  }> {
    try {
      // ContentOrchestrationService를 통해 각 상태별 콘텐츠 수 조회
      const [activeCount, inactiveCount, underReviewCount, flaggedCount, removedCount] = await Promise.all([
        this.contentService.countByStatus('active'),
        this.contentService.countByStatus('inactive'),
        this.contentService.countByStatus('under_review'),
        this.contentService.countByStatus('flagged'),
        this.contentService.countByStatus('removed'),
      ]);

      return {
        active: activeCount,
        inactive: inactiveCount,
        under_review: underReviewCount,
        flagged: flaggedCount,
        removed: removedCount,
      };
    } catch (error: unknown) {
      this.logger.warn('Failed to get content counts by status', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // 에러 발생 시 기본값 반환
      return {
        active: 0,
        inactive: 0,
        under_review: 0,
        flagged: 0,
        removed: 0,
      };
    }
  }
}
