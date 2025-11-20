import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import { PaginatedResult } from '@krgeobuk/core/interfaces';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiErrorResponse,
  SwaggerApiParam,
  SwaggerApiBearerAuth,
} from '@krgeobuk/swagger';

import { ContentService } from '../services/content.service.js';
import { ContentSearchQueryDto } from '../dto/search-query.dto.js';
import { ContentWithCreatorDto } from '../dto/content-response.dto.js';
import { UpdateContentStatusDto } from '../dto/update-content-status.dto.js';
import { BulkUpdateContentStatusDto } from '../dto/bulk-update-content-status.dto.js';
import { UserInteractionService } from '../../user-interaction/services/user-interaction.service.js';
import { YouTubeSyncScheduler } from '../../external-api/services/youtube-sync.scheduler.js';

@SwaggerApiTags({ tags: ['content'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly interactionService: UserInteractionService,
    private readonly youtubeSyncScheduler: YouTubeSyncScheduler
  ) {}

  /**
   * 콘텐츠 검색
   * GET /content?page=1&limit=30&creatorId=xxx&platform=youtube&sortBy=views
   */
  @SwaggerApiOperation({
    summary: '콘텐츠 검색',
    description: '크리에이터, 플랫폼, 타입 등 다양한 조건으로 콘텐츠를 검색합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '콘텐츠 목록 조회 성공',
    dto: ContentWithCreatorDto,
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 검색 파라미터',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get()
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠 목록 조회 성공',
  })
  async searchContents(
    @Query() query: ContentSearchQueryDto
  ): Promise<PaginatedResult<ContentWithCreatorDto>> {
    return await this.contentService.searchContents(query);
  }

  /**
   * 북마크한 콘텐츠 목록 조회 (전체 콘텐츠 정보 포함)
   * GET /content/bookmarks?page=1&limit=20
   */
  @SwaggerApiOperation({
    summary: '북마크 목록 조회',
    description: '현재 사용자가 북마크한 콘텐츠 목록을 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '북마크 목록 조회 성공',
    dto: ContentWithCreatorDto,
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get('bookmarks')
  @HttpCode(200)
  @Serialize({
    message: '북마크 목록 조회 성공',
  })
  async getBookmarkedContents(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Query() query: ContentSearchQueryDto
  ): Promise<{
    items: ContentWithCreatorDto[];
    pageInfo: {
      totalItems: number;
      page: number;
      limit: number;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }> {
    // ContentService에서 user_interactions + content + creator 3-way JOIN으로 조회
    const result = await this.contentService.findBookmarkedContents(userId, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return result;
  }

  /**
   * 콘텐츠 상세 조회
   * GET /content/:id
   */
  @SwaggerApiOperation({
    summary: '콘텐츠 상세 조회',
    description: '특정 콘텐츠의 상세 정보를 조회합니다. 크리에이터 정보도 함께 포함됩니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 상세 조회 성공',
    dto: ContentWithCreatorDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get(':id')
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠 상세 조회 성공',
  })
  async getContentDetail(@Param('id') id: string): Promise<ContentWithCreatorDto | null> {
    return await this.contentService.findWithCreator(id);
  }

  // ==================== BOOKMARK ENDPOINTS ====================

  /**
   * 북마크 추가
   * POST /content/:id/bookmark
   */
  @SwaggerApiOperation({
    summary: '북마크 추가',
    description: '콘텐츠를 북마크에 추가합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '북마크 추가 성공',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 북마크에 추가된 콘텐츠입니다',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post(':id/bookmark')
  @HttpCode(204)
  @Serialize({
    message: '북마크 추가 성공',
  })
  async bookmarkContent(
    @Param('id') contentId: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.interactionService.bookmarkContent(userId, contentId);
  }

  /**
   * 북마크 제거
   * DELETE /content/:id/bookmark
   */
  @SwaggerApiOperation({
    summary: '북마크 제거',
    description: '콘텐츠를 북마크에서 제거합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '북마크 제거 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '북마크를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Delete(':id/bookmark')
  @HttpCode(204)
  @Serialize({
    message: '북마크 제거 성공',
  })
  async removeBookmark(
    @Param('id') contentId: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.interactionService.removeBookmark(userId, contentId);
  }

  // ==================== LIKE ENDPOINTS ====================

  /**
   * 좋아요 추가
   * POST /content/:id/like
   */
  @SwaggerApiOperation({
    summary: '좋아요 추가',
    description: '콘텐츠에 좋아요를 추가합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '좋아요 추가 성공',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 좋아요를 누른 콘텐츠입니다',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post(':id/like')
  @HttpCode(204)
  @Serialize({
    message: '좋아요 추가 성공',
  })
  async likeContent(
    @Param('id') contentId: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.interactionService.likeContent(userId, contentId);
  }

  /**
   * 좋아요 제거
   * DELETE /content/:id/like
   */
  @SwaggerApiOperation({
    summary: '좋아요 제거',
    description: '콘텐츠에서 좋아요를 제거합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 204,
    description: '좋아요 제거 성공',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '좋아요를 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Delete(':id/like')
  @HttpCode(204)
  @Serialize({
    message: '좋아요 제거 성공',
  })
  async unlikeContent(
    @Param('id') contentId: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.interactionService.unlikeContent(userId, contentId);
  }

  // ==================== ADMIN SYNC ENDPOINTS ====================

  /**
   * 플랫폼 콘텐츠 수동 동기화 (관리자용)
   * POST /content/sync/:platformId
   *
   * Note: 관리자 권한 검증은 추후 추가 예정
   */
  @SwaggerApiOperation({
    summary: '플랫폼 콘텐츠 수동 동기화',
    description: '특정 플랫폼의 콘텐츠를 수동으로 동기화합니다. (관리자용)',
  })
  @SwaggerApiParam({
    name: 'platformId',
    type: String,
    description: '플랫폼 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 동기화 요청 처리 완료 (응답: { success: boolean, message: string, syncedCount?: number, error?: string })',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼을 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post('sync/:platformId')
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠 동기화 요청 처리 완료',
  })
  async syncPlatformContent(
    @Param('platformId') platformId: string
  ): Promise<{
    success: boolean;
    message: string;
    syncedCount?: number;
    error?: string;
  }> {
    const result = await this.youtubeSyncScheduler.syncSinglePlatform(platformId);
    return result;
  }

  /**
   * 크리에이터 전체 콘텐츠 동기화 (초기 동기화)
   * POST /content/sync/:platformId/full
   *
   * 사용 사례:
   * - 크리에이터 신청 승인 후 처음으로 모든 콘텐츠 수집
   * - 관리자가 특정 채널의 전체 데이터를 다시 수집
   *
   * Note: 관리자 권한 검증은 추후 추가 예정
   */
  @SwaggerApiOperation({
    summary: '전체 콘텐츠 동기화',
    description: '특정 플랫폼의 모든 콘텐츠를 동기화합니다. 초기 동기화 또는 전체 재수집 시 사용합니다. (관리자용)',
  })
  @SwaggerApiParam({
    name: 'platformId',
    type: String,
    description: '플랫폼 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '전체 콘텐츠 동기화 요청 처리 완료 (응답: { success: boolean, message: string, totalCount?: number, estimatedQuotaUsage?: number, error?: string })',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼을 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post('sync/:platformId/full')
  @HttpCode(200)
  @Serialize({
    message: '전체 콘텐츠 동기화 요청 처리 완료',
  })
  async syncAllPlatformContent(
    @Param('platformId') platformId: string
  ): Promise<{
    success: boolean;
    message: string;
    totalCount?: number;
    estimatedQuotaUsage?: number;
    error?: string;
  }> {
    const result = await this.youtubeSyncScheduler.syncAllContent(platformId);
    return result;
  }

  /**
   * 초기 동기화 재개
   * POST /content/sync/:platformId/resume
   *
   * 사용 사례:
   * - 일시 중지되었던 초기 동기화를 다시 시작
   * - 실패했던 동기화를 재시도
   *
   * Note: 관리자 권한 검증은 추후 추가 예정
   */
  @SwaggerApiOperation({
    summary: '초기 동기화 재개',
    description: '일시 중지되었던 초기 동기화를 재개합니다. (관리자용)',
  })
  @SwaggerApiParam({
    name: 'platformId',
    type: String,
    description: '플랫폼 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '초기 동기화 재개 요청 처리 완료 (응답: { success: boolean, message: string, resumedCount?: number, error?: string })',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼을 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post('sync/:platformId/resume')
  @HttpCode(200)
  @Serialize({
    message: '초기 동기화 재개 요청 처리 완료',
  })
  async resumeInitialSync(
    @Param('platformId') platformId: string
  ): Promise<{
    success: boolean;
    message: string;
    resumedCount?: number;
    error?: string;
  }> {
    const result = await this.youtubeSyncScheduler.resumeInitialSync(platformId);
    return result;
  }

  // ==================== CREATOR DASHBOARD APIs ====================

  /**
   * 크리에이터가 자신의 콘텐츠 상태 변경 (공개/비공개 전환 등)
   * PATCH /content/:id/status
   */
  @SwaggerApiOperation({
    summary: '콘텐츠 상태 변경 (크리에이터 전용)',
    description: '크리에이터가 자신의 콘텐츠 상태를 변경합니다 (공개/비공개 등).',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 상태 변경 성공',
    dto: null,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '권한 없음 (본인의 콘텐츠만 수정 가능)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다',
  })
  @Patch(':id/status')
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠 상태가 변경되었습니다',
  })
  async updateContentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContentStatusDto,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.contentService.updateContentStatusByCreator(id, userId, dto.status);
  }

  /**
   * 크리에이터가 자신의 콘텐츠 삭제 (소프트 삭제)
   * DELETE /content/:id
   */
  @SwaggerApiOperation({
    summary: '콘텐츠 삭제 (크리에이터 전용)',
    description: '크리에이터가 자신의 콘텐츠를 삭제합니다 (소프트 삭제).',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '콘텐츠 ID',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 삭제 성공',
    dto: null,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '권한 없음 (본인의 콘텐츠만 삭제 가능)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '콘텐츠를 찾을 수 없습니다',
  })
  @Delete(':id')
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠가 삭제되었습니다',
  })
  async deleteContent(
    @Param('id') id: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.contentService.deleteContentByCreator(id, userId);
  }

  /**
   * 크리에이터가 자신의 여러 콘텐츠 상태 일괄 변경
   * PATCH /content/bulk-update-status
   */
  @SwaggerApiOperation({
    summary: '콘텐츠 일괄 상태 변경 (크리에이터 전용)',
    description: '크리에이터가 자신의 여러 콘텐츠 상태를 동시에 변경합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '콘텐츠 일괄 상태 변경 성공',
    dto: null,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '권한 없음 (본인의 콘텐츠만 수정 가능)',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 (contentIds가 비어있음)',
  })
  @Patch('bulk-update-status')
  @HttpCode(200)
  @Serialize({
    message: '콘텐츠 상태가 일괄 변경되었습니다',
  })
  async bulkUpdateContentStatus(
    @Body() dto: BulkUpdateContentStatusDto,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<void> {
    await this.contentService.bulkUpdateContentStatusByCreator(dto.contentIds, userId, dto.status);
  }
}
