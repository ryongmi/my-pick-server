import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiBearerAuth,
  SwaggerApiOperation,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { Serialize } from '@krgeobuk/core/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';

import { 
  PlatformApplicationService,
  PlatformApplicationStatisticsService,
  PlatformApplicationReviewService,
} from '../../platform-application/services/index.js';
import {
  ApplicationDetailDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  PlatformApplicationSearchQueryDto,
  ApplicationStatsDto,
  RejectionReasonItemDto,
} from '../../platform-application/dto/index.js';
import { RejectionReason } from '../../platform-application/enums/index.js';
import { PlatformApplicationException } from '../../platform-application/exceptions/index.js';

@SwaggerApiTags({ tags: ['admin-platform-applications'] })
@SwaggerApiBearerAuth()
@Controller('admin/platform-applications')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
export class AdminPlatformApplicationController {
  constructor(
    private readonly platformApplicationService: PlatformApplicationService,
    private readonly statisticsService: PlatformApplicationStatisticsService,
    private readonly reviewService: PlatformApplicationReviewService,
  ) {}

  @Get()
  @SwaggerApiOperation({
    summary: '플랫폼 신청 목록 조회 (관리자)',
    description:
      '관리자가 모든 플랫폼 신청 목록을 조회합니다. 검색, 필터링, 페이지네이션을 지원합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '플랫폼 신청 목록 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '관리자 권한이 필요합니다.',
  })
  @RequirePermission('platform-application:read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplications(
    @Query() query: PlatformApplicationSearchQueryDto
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    return await this.platformApplicationService.searchApplications(query);
  }

  @Get('stats')
  @SwaggerApiOperation({
    summary: '플랫폼 신청 통계 조회 (관리자)',
    description:
      '관리자가 플랫폼 신청 통계를 조회합니다. 전체/승인/거부/대기 신청 수 등을 제공합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청 통계 조회 성공',
    dto: ApplicationStatsDto,
  })
  @RequirePermission('platform-application:read')
  @Serialize({ dto: ApplicationStatsDto })
  async getApplicationStats(): Promise<ApplicationStatsDto> {
    return await this.statisticsService.getApplicationStats();
  }

  @Get('creator/:creatorId')
  @SwaggerApiOperation({
    summary: '크리에이터별 플랫폼 신청 목록 조회 (관리자)',
    description: '관리자가 특정 크리에이터의 모든 플랫폼 신청 내역을 조회합니다.',
  })
  @SwaggerApiParam({ name: 'creatorId', type: String, description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터별 플랫폼 신청 목록 조회 성공',
    dto: ApplicationDetailDto,
    isArray: true,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  @RequirePermission('platform-application:read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationsByCreator(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<ApplicationDetailDto[]> {
    const applications = await this.platformApplicationService.findByCreatorId(creatorId);
    return applications.map((app): ApplicationDetailDto => {
      const result: ApplicationDetailDto = {
        id: app.id,
        creatorId: app.creatorId,
        userId: app.userId,
        platformType: app.platformType,
        appliedAt: app.appliedAt,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };

      // Only include optional properties if they have values
      if (app.reviewedAt) {
        result.reviewedAt = app.reviewedAt;
      }
      if (app.reviewerId) {
        result.reviewerId = app.reviewerId;
      }

      return result;
    });
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '플랫폼 신청 상세 조회 (관리자)',
    description: '관리자가 특정 플랫폼 신청의 상세 정보를 조회합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '플랫폼 신청 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청 상세 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없습니다.' })
  @RequirePermission('platform-application:read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationDetail(
    @Param('id', ParseUUIDPipe) applicationId: string
  ): Promise<ApplicationDetailDto> {
    return await this.platformApplicationService.getApplicationDetail(applicationId);
  }

  @Post(':id/approve')
  @SwaggerApiOperation({
    summary: '플랫폼 신청 승인 (관리자)',
    description: '관리자가 플랫폼 신청을 승인합니다. 승인 시 크리에이터 플랫폼이 생성됩니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '플랫폼 신청 ID' })
  @SwaggerApiBody({ dto: ApproveApplicationDto })
  @SwaggerApiOkResponse({ status: 200, description: '플랫폼 신청이 성공적으로 승인되었습니다.' })
  @SwaggerApiErrorResponse({ status: 400, description: '이미 검토된 신청이거나 잘못된 요청' })
  @SwaggerApiErrorResponse({ status: 403, description: '자신의 신청은 검토할 수 없음' })
  @SwaggerApiErrorResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없음' })
  @RequirePermission('platform-application:approve')
  async approveApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: ApproveApplicationDto
    // @CurrentUser() admin: UserInfo
  ): Promise<void> {
    await this.reviewService.approveApplication(applicationId, dto, 'admin-user-id'); // TODO: CurrentUser 구현 후 실제 admin.id 사용
  }

  @Post(':id/reject')
  @SwaggerApiOperation({
    summary: '플랫폼 신청 거부 (관리자)',
    description: '관리자가 플랫폼 신청을 거부합니다. 거부 사유를 포함해야 합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '플랫폼 신청 ID' })
  @SwaggerApiBody({ dto: RejectApplicationDto })
  @SwaggerApiOkResponse({ status: 200, description: '플랫폼 신청이 성공적으로 거부되었습니다.' })
  @SwaggerApiErrorResponse({ status: 400, description: '이미 검토된 신청이거나 잘못된 요청' })
  @SwaggerApiErrorResponse({ status: 403, description: '자신의 신청은 검토할 수 없음' })
  @SwaggerApiErrorResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없음' })
  @RequirePermission('platform-application:reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: RejectApplicationDto
    // @CurrentUser() admin: UserInfo
  ): Promise<void> {
    await this.reviewService.rejectApplication(applicationId, dto, 'admin-user-id'); // TODO: CurrentUser 구현 후 실제 admin.id 사용
  }

  @Get('rejection-reasons')
  @SwaggerApiOperation({
    summary: '플랫폼 신청 거부 사유 목록 조회 (관리자)',
    description: '관리자가 플랫폼 신청 거부 시 사용할 수 있는 표준 거부 사유 목록을 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '거부 사유 목록 및 메시지 조회 성공',
    dto: RejectionReasonItemDto,
    isArray: true,
  })
  @RequirePermission('platform-application:read')
  @Serialize({ dto: RejectionReasonItemDto })
  async getRejectionReasons(): Promise<RejectionReasonItemDto[]> {
    return Object.values(RejectionReason).map((reason) => ({
      code: reason,
      message: PlatformApplicationException.getRejectionReasonMessage(reason),
    }));
  }
}
