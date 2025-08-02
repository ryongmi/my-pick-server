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
} from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { ContentService } from '../../content/services/index.js';
import { ReportService } from '../../report/services/index.js';
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
  constructor(
    private readonly contentService: ContentService,
    private readonly reportService: ReportService,
  ) {}

  @Get()
  @RequirePermission('content:read')
  async getContentList(
    @Query() query: AdminContentSearchQueryDto,
    // @CurrentUser() admin: UserInfo,
  ): Promise<PaginatedResult<AdminContentListItemDto>> {
    try {
      // ContentService의 searchContent를 활용하되, 관리자용으로 변환
      const searchQuery = {
        creatorId: query.creatorId,
        type: query.type,
        platform: query.platform,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy === 'title' ? 'createdAt' : query.sortBy, // title 정렬은 createdAt로 매핑
        sortOrder: query.sortOrder,
      };

      const result = await this.contentService.searchContent(searchQuery);

      // 관리자용 DTO로 변환 (신고 수 조회 포함)
      const adminItems = await Promise.all(result.items.map(async (content) => {
        // 각 콘텐츠의 신고 수 조회
        const reportsResult = await this.reportService.searchReports({
          targetType: 'content' as any,
          targetId: content.id,
          page: 1,
          limit: 1, // 개수만 필요하므로 1개만 조회
        }).catch(() => ({ pageInfo: { totalItems: 0 } }));

        return plainToInstance(AdminContentListItemDto, {
          id: content.id,
          type: content.type,
          title: content.title,
          platform: content.platform,
          status: content.status || ContentStatus.ACTIVE,
          publishedAt: content.publishedAt,
          createdAt: content.createdAt,
          creator: content.creator ? {
            id: content.creator.id,
            name: content.creator.name,
            displayName: content.creator.displayName,
          } : {
            id: 'unknown',
            name: 'Unknown Creator',
            displayName: 'Unknown Creator',
          },
          statistics: {
            views: Number(content.statistics.views),
            likes: content.statistics.likes,
            comments: content.statistics.comments,
          },
          flagCount: reportsResult.pageInfo.totalItems,
          lastModeratedAt: content.moderatedAt,
          moderatedBy: content.moderatedBy,
        }, {
          excludeExtraneousValues: true,
        });
      }));

      return {
        items: adminItems,
        pageInfo: {
          page: result.pageInfo.page,
          limit: result.pageInfo.limit,
          totalItems: result.pageInfo.totalItems,
          totalPages: result.pageInfo.totalPages,
          hasPreviousPage: result.pageInfo.hasPreviousPage,
          hasNextPage: result.pageInfo.hasNextPage
        }
      } as PaginatedResult<AdminContentListItemDto>;
    } catch (error: unknown) {
      throw AdminException.contentDataFetchError();
    }
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentDetail(
    @Param('id', ParseUUIDPipe) contentId: string,
  ): Promise<AdminContentDetailDto> {
    try {
      const content = await this.contentService.getContentById(contentId);

      // 콘텐츠의 신고 목록 조회
      const reportsResult = await this.reportService.searchReports({
        targetType: 'content' as any,
        targetId: contentId,
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      }).catch(() => ({ items: [], pageInfo: { totalItems: 0 } }));

      const flags = reportsResult.items.map(report => ({
        id: report.id,
        reason: report.reason,
        description: report.description,
        reportedBy: report.reporterId,
        reportedAt: report.createdAt,
        status: report.status,
      }));

      return plainToInstance(AdminContentDetailDto, {
        id: content.id,
        type: content.type,
        title: content.title,
        description: content.description,
        thumbnail: content.thumbnail,
        url: content.url,
        platform: content.platform,
        platformId: content.platformId,
        duration: content.duration,
        status: content.status || ContentStatus.ACTIVE,
        publishedAt: content.publishedAt,
        createdAt: content.createdAt,
        creator: {
          id: content.creator.id,
          name: content.creator.name,
          displayName: content.creator.displayName,
        },
        statistics: {
          views: Number(content.statistics.views),
          likes: content.statistics.likes,
          comments: content.statistics.comments,
        },
        metadata: content.metadata,
        flagCount: reportsResult.pageInfo.totalItems,
        flags,
        moderationHistory: content.moderatedAt ? [{
          action: content.status || 'active',
          moderatedBy: content.moderatedBy || 'system',
          moderatedAt: content.moderatedAt,
          reason: content.statusReason,
        }] : [],
      }, {
        excludeExtraneousValues: true,
      });
    } catch (error: unknown) {
      throw AdminException.contentDataFetchError();
    }
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('content:write')
  async updateContentStatus(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() dto: UpdateContentStatusDto,
    @CurrentJwt() { id }: JwtPayload,
  ): Promise<void> {
    try {
      // 실제 상태 업데이트 실행
      await this.contentService.updateContentStatus(
        contentId,
        dto.status,
        id, // JWT에서 추출한 관리자 ID
        dto.reason,
      );
    } catch (error: unknown) {
      throw AdminException.contentStatusUpdateError();
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('content:delete')
  async deleteContent(
    @Param('id', ParseUUIDPipe) contentId: string,
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    try {
      await this.contentService.deleteContent(contentId);
      
      // TODO: 삭제 로그 기록
      console.log(`Content ${contentId} deleted by admin`);
    } catch (error: unknown) {
      throw AdminException.contentStatusUpdateError();
    }
  }

  @Get(':id/flags')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentFlags(
    @Param('id', ParseUUIDPipe) contentId: string,
  ): Promise<{
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
      // 콘텐츠에 대한 신고 목록 조회
      const reportsResult = await this.reportService.searchReports({
        targetType: 'content' as any,
        targetId: contentId,
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      const flags = reportsResult.items.map(report => ({
        id: report.id,
        reason: report.reason,
        description: report.description,
        reportedBy: report.reporterId,
        reportedAt: report.createdAt,
        status: report.status,
      }));

      return { flags };
    } catch (error: unknown) {
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
    @CurrentJwt() { id }: JwtPayload,
  ): Promise<void> {
    try {
      if (body.action === 'approve') {
        // 신고 승인 - 콘텐츠 상태를 flagged로 변경
        await this.contentService.updateContentStatus(
          contentId,
          'flagged',
          id,
          `Report approved: ${body.reason || 'No reason provided'}`,
        );

        // 신고 상태를 resolved로 변경
        await this.reportService.reviewReport(flagId, id, {
          status: 'resolved',
          comment: body.reason || 'Report approved - content flagged',
        });
      } else {
        // 신고 기각
        await this.reportService.reviewReport(flagId, id, {
          status: 'dismissed',
          comment: body.reason || 'Report dismissed by admin',
        });
      }
    } catch (error: unknown) {
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
      // 실제 콘텐츠 상태 통계 조회
      const statusStats = await this.contentService.getContentStatusStatistics();

      // 플랫폼별 통계는 현재 구현되지 않았으므로 임시 데이터 사용
      // TODO: ContentService에 플랫폼별 통계 메서드 추가 필요
      const contentByPlatform = [
        { platform: 'youtube', count: Math.floor(statusStats.totalContent * 0.6) },
        { platform: 'twitter', count: Math.floor(statusStats.totalContent * 0.3) },
        { platform: 'instagram', count: Math.floor(statusStats.totalContent * 0.1) },
      ];

      return {
        totalContent: statusStats.totalContent,
        activeContent: statusStats.activeContent,
        inactiveContent: statusStats.inactiveContent,
        flaggedContent: statusStats.flaggedContent,
        removedContent: statusStats.removedContent,
        contentByPlatform,
        contentByStatus: statusStats.contentByStatus,
      };
    } catch (error: unknown) {
      throw AdminException.statisticsGenerationError();
    }
  }
}