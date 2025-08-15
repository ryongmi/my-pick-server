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

      // 관리자용 DTO로 변환
      const adminItems = result.items.map((content) => {
        // TODO: ReportService 구현 후 신고 수 조회 로직 추가

        return plainToInstance(
          AdminContentListItemDto,
          {
            id: content.id,
            type: content.type,
            title: content.title,
            platform: content.platform,
            status: ContentStatus.ACTIVE, // TODO: content entity에 status 필드 추가
            publishedAt: content.publishedAt,
            createdAt: content.createdAt,
            creator: {
              id: content.creatorId,
              name: `Creator ${content.creatorId}`, // TODO: creator 정보 조회
              displayName: `Creator ${content.creatorId}`,
            },
            statistics: {
              views: content.statistics?.views || 0,
              likes: content.statistics?.likes || 0,
              comments: content.statistics?.comments || 0,
            },
            flagCount: 0, // TODO: ReportService 구현 후 추가
            lastModeratedAt: undefined, // TODO: moderation 기능 구현 후 추가
            moderatedBy: undefined,
          },
          {
            excludeExtraneousValues: true,
          }
        );
      });

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

      this.logger.log('Admin content detail fetched successfully', {
        adminId: userId,
        contentId,
        contentType: content.type,
        platform: content.platform,
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
          status: ContentStatus.ACTIVE, // TODO: content entity에 status 필드 추가
          publishedAt: content.publishedAt,
          createdAt: content.createdAt,
          creator: {
            id: content.creatorId,
            name: `Creator ${content.creatorId}`, // TODO: creator 정보 조회
            displayName: `Creator ${content.creatorId}`,
          },
          statistics: {
            views: content.statistics?.views || 0,
            likes: content.statistics?.likes || 0,
            comments: content.statistics?.comments || 0,
          },
          // metadata: content.metadata, // TODO: Add metadata field to ContentDetailDto
          flagCount: 0, // TODO: ReportService 구현 후 추가
          flags: [], // TODO: ReportService 구현 후 신고 목록 추가
          moderationHistory: [], // TODO: moderation 기능 구현 후 추가
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

      // TODO: ContentService에 updateContentStatus 메서드 구현 필요
      // await this.contentService.updateContentStatus(
      //   contentId,
      //   dto.status,
      //   adminId, // JWT에서 추출한 관리자 ID
      //   dto.reason,
      // );

      // 임시로 콘텐츠 존재 여부만 확인
      await this.contentService.findByIdOrFail(contentId);

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
      // TODO: ReportService 구현 후 콘텐츠 신고 목록 조회
      await this.contentService.findByIdOrFail(contentId);

      return { flags: [] };
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
      // TODO: ReportService 구현 후 신고 처리 로직 구현
      await this.contentService.findByIdOrFail(contentId);

      // 임시로 로직 구현 (실제로는 신고 처리)
      if (body.action === 'approve') {
        // TODO: 콘텐츠 상태 변경 및 신고 승인 처리
      } else {
        // TODO: 신고 기각 처리
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
      const stats = await this.contentStatisticsService.getContentStatistics();
      
      return {
        totalContent: stats.totalContent,
        activeContent: stats.totalContent - stats.ageRestrictedContent, // 임시 계산
        inactiveContent: stats.ageRestrictedContent,
        flaggedContent: 0, // TODO: 신고 시스템 구현 후 추가
        removedContent: 0, // TODO: 삭제된 콘텐츠 추적 시스템 구현 후 추가
        contentByPlatform: stats.contentByPlatform,
        contentByStatus: [
          { status: 'active', count: stats.totalContent - stats.ageRestrictedContent },
          { status: 'inactive', count: stats.ageRestrictedContent },
          { status: 'flagged', count: 0 },
          { status: 'removed', count: 0 },
        ],
      };
    } catch (_error: unknown) {
      throw AdminException.statisticsGenerationError();
    }
  }
}
