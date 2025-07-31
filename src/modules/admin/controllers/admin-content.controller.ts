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

import { ContentService } from '../../content/services/index.js';
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

      // 관리자용 DTO로 변환
      const adminItems = result.items.map((content) => {
        return plainToInstance(AdminContentListItemDto, {
          id: content.id,
          type: content.type,
          title: content.title,
          platform: content.platform,
          status: ContentStatus.ACTIVE, // TODO: 실제 상태 필드 추가 필요
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
          flagCount: 0, // TODO: 신고 수 구현 필요
          lastModeratedAt: undefined, // TODO: 모더레이션 이력 구현 필요
          moderatedBy: undefined,
        }, {
          excludeExtraneousValues: true,
        });
      });

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
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminContentDetailDto> {
    try {
      const content = await this.contentService.getContentById(contentId);

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
        status: ContentStatus.ACTIVE, // TODO: 실제 상태 필드 추가 필요
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
        flagCount: 0, // TODO: 신고 수 구현 필요
        flags: [], // TODO: 신고 목록 구현 필요
        moderationHistory: [], // TODO: 모더레이션 이력 구현 필요
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
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    try {
      // 콘텐츠 존재 확인
      await this.contentService.findByIdOrFail(contentId);

      // TODO: 실제 상태 업데이트 구현
      // 현재는 로깅만 수행
      console.log(`Content ${contentId} status updated to ${dto.status} by ${dto.moderatedBy}`);
      
      // TODO: 모더레이션 이력 저장
      // TODO: 상태에 따른 추가 액션 (알림 등)

      if (dto.status === ContentStatus.REMOVED || dto.status === ContentStatus.FLAGGED) {
        // TODO: 콘텐츠 숨김 처리 또는 제거
        console.log(`Content ${contentId} removed/flagged with reason: ${dto.reason}`);
      }
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
    // @CurrentUser() admin: UserInfo,
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
      // TODO: 콘텐츠 신고 목록 조회 구현
      
      return {
        flags: [], // 임시 빈 배열
      };
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
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    try {
      // TODO: 신고 처리 구현
      console.log(`Flag ${flagId} on content ${contentId} resolved with action: ${body.action}`);
      
      if (body.action === 'approve') {
        // 신고 승인 - 콘텐츠 상태 변경
        console.log(`Content ${contentId} flagged due to approved report`);
      } else {
        // 신고 기각
        console.log(`Report ${flagId} dismissed`);
      }
    } catch (error: unknown) {
      throw AdminException.moderationActionError();
    }
  }

  @Get('statistics/overview')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentStatistics(
    // @CurrentUser() admin: UserInfo,
  ): Promise<{
    totalContent: number;
    activeContent: number;
    flaggedContent: number;
    removedContent: number;
    contentByPlatform: Array<{ platform: string; count: number }>;
    contentByStatus: Array<{ status: string; count: number }>;
  }> {
    try {
      // TODO: 콘텐츠 통계 구현
      
      return {
        totalContent: 2500,
        activeContent: 2300,
        flaggedContent: 150,
        removedContent: 50,
        contentByPlatform: [
          { platform: 'youtube', count: 1500 },
          { platform: 'twitter', count: 800 },
          { platform: 'instagram', count: 200 },
        ],
        contentByStatus: [
          { status: 'active', count: 2300 },
          { status: 'flagged', count: 150 },
          { status: 'removed', count: 50 },
        ],
      };
    } catch (error: unknown) {
      throw AdminException.statisticsGenerationError();
    }
  }
}