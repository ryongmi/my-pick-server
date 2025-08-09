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
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @RequirePermission('content:read')
  async getContentList(
    @Query() query: AdminContentSearchQueryDto
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
              views: 0, // TODO: content statistics 조회
              likes: 0,
              comments: 0,
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

      return {
        items: adminItems,
        pageInfo: {
          page: result.pageInfo.page,
          limit: result.pageInfo.limit,
          totalItems: result.pageInfo.totalItems,
          totalPages: result.pageInfo.totalPages,
          hasPreviousPage: result.pageInfo.hasPreviousPage,
          hasNextPage: result.pageInfo.hasNextPage,
        },
      } as PaginatedResult<AdminContentListItemDto>;
    } catch (_error: unknown) {
      throw AdminException.contentDataFetchError();
    }
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  @RequirePermission('content:read')
  async getContentDetail(
    @Param('id', ParseUUIDPipe) contentId: string
  ): Promise<AdminContentDetailDto> {
    try {
      const content = await this.contentService.getContentById(contentId);

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
            views: 0, // TODO: content statistics 조회
            likes: 0,
            comments: 0,
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
    } catch (_error: unknown) {
      throw AdminException.contentDataFetchError();
    }
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('content:write')
  async updateContentStatus(
    @Param('id', ParseUUIDPipe) contentId: string,
    @Body() _dto: UpdateContentStatusDto,
    @CurrentJwt() { id: _id }: JwtPayload
  ): Promise<void> {
    try {
      // TODO: ContentService에 updateContentStatus 메서드 구현 필요
      // await this.contentService.updateContentStatus(
      //   contentId,
      //   dto.status,
      //   id, // JWT에서 추출한 관리자 ID
      //   dto.reason,
      // );

      // 임시로 콘텐츠 존재 여부만 확인
      await this.contentService.findByIdOrFail(contentId);
    } catch (_error: unknown) {
      throw AdminException.contentStatusUpdateError();
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  @RequirePermission('content:delete')
  async deleteContent(
    @Param('id', ParseUUIDPipe) contentId: string
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    try {
      // TODO: ContentService에 deleteContent 메서드 구현 필요
      // await this.contentService.deleteContent(contentId);

      // 임시로 콘텐츠 존재 여부만 확인
      await this.contentService.findByIdOrFail(contentId);
    } catch (_error: unknown) {
      throw AdminException.contentStatusUpdateError();
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
    @CurrentJwt() { id: _id }: JwtPayload
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
      // TODO: ContentService에 통계 메서드 구현 필요
      // const statusStats = await this.contentService.getContentStatusStatistics();

      // 임시로 기본 값 반환
      return {
        totalContent: 0,
        activeContent: 0,
        inactiveContent: 0,
        flaggedContent: 0,
        removedContent: 0,
        contentByPlatform: [
          { platform: 'youtube', count: 0 },
          { platform: 'twitter', count: 0 },
          { platform: 'instagram', count: 0 },
        ],
        contentByStatus: [
          { status: 'active', count: 0 },
          { status: 'inactive', count: 0 },
          { status: 'flagged', count: 0 },
          { status: 'removed', count: 0 },
        ],
      };
    } catch (_error: unknown) {
      throw AdminException.statisticsGenerationError();
    }
  }
}
