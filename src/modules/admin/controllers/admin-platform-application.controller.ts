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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { Serialize } from '@krgeobuk/core/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { RequirePermission } from '@krgeobuk/authorization/decorators';

// TODO: 실제 공유 패키지 설치 후 import
// import { AuthGuard, AdminGuard, CurrentUser } from '@krgeobuk/authorization';
// import { UserInfo } from '@krgeobuk/auth/interfaces';

// 임시 타입 및 데코레이터 정의
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

const AuthGuard = () => () => {};
const AdminGuard = () => () => {};
const CurrentUser = () => (target: any, propertyKey: string, parameterIndex: number) => {};

import { PlatformApplicationService } from '../../platform-application/services/index.js';
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

@ApiTags('Admin - Platform Applications')
@ApiBearerAuth()
@Controller('admin/platform-applications')
@UseGuards(AuthGuard, AdminGuard)
export class AdminPlatformApplicationController {
  constructor(private readonly platformApplicationService: PlatformApplicationService) {}

  @Get()
  @ApiOperation({ summary: '플랫폼 신청 목록 조회 (관리자)' })
  @ApiResponse({
    status: 200,
    description: '플랫폼 신청 목록 조회 성공',
  })
  @RequirePermission('admin.platform-applications.read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplications(
    @Query() query: PlatformApplicationSearchQueryDto
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    return await this.platformApplicationService.searchApplications(query);
  }

  @Get('stats')
  @ApiOperation({ summary: '플랫폼 신청 통계 조회 (관리자)' })
  @ApiResponse({
    status: 200,
    description: '플랫폼 신청 통계 조회 성공',
    type: ApplicationStatsDto,
  })
  @RequirePermission('admin.platform-applications.read')
  @Serialize({ dto: ApplicationStatsDto })
  async getApplicationStats(): Promise<ApplicationStatsDto> {
    return await this.platformApplicationService.getApplicationStats();
  }

  @Get('creator/:creatorId')
  @ApiOperation({ summary: '크리에이터별 플랫폼 신청 목록 조회 (관리자)' })
  @ApiResponse({
    status: 200,
    description: '크리에이터별 플랫폼 신청 목록 조회 성공',
    type: [ApplicationDetailDto],
  })
  @RequirePermission('admin.platform-applications.read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationsByCreator(
    @Param('creatorId', ParseUUIDPipe) creatorId: string
  ): Promise<ApplicationDetailDto[]> {
    const applications = await this.platformApplicationService.findByCreatorId(creatorId);
    
    return applications.map(app => ({
      id: app.id,
      creatorId: app.creatorId,
      userId: app.userId,
      status: app.status,
      platformData: app.platformData,
      reviewData: app.reviewData,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      reviewedAt: app.reviewedAt,
      reviewerId: app.reviewerId,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: '플랫폼 신청 상세 조회 (관리자)' })
  @ApiResponse({
    status: 200,
    description: '플랫폼 신청 상세 조회 성공',
    type: ApplicationDetailDto,
  })
  @ApiResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없음' })
  @RequirePermission('admin.platform-applications.read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationDetail(
    @Param('id', ParseUUIDPipe) applicationId: string
  ): Promise<ApplicationDetailDto> {
    return await this.platformApplicationService.getApplicationDetail(applicationId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: '플랫폼 신청 승인 (관리자)' })
  @ApiResponse({ status: 200, description: '플랫폼 신청이 성공적으로 승인되었습니다.' })
  @ApiResponse({ status: 400, description: '이미 검토된 신청이거나 잘못된 요청' })
  @ApiResponse({ status: 403, description: '자신의 신청은 검토할 수 없음' })
  @ApiResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없음' })
  @RequirePermission('admin.platform-applications.approve')
  async approveApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: ApproveApplicationDto,
    @CurrentUser() admin: UserInfo
  ): Promise<void> {
    await this.platformApplicationService.approveApplication(applicationId, dto, admin.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '플랫폼 신청 거부 (관리자)' })
  @ApiResponse({ status: 200, description: '플랫폼 신청이 성공적으로 거부되었습니다.' })
  @ApiResponse({ status: 400, description: '이미 검토된 신청이거나 잘못된 요청' })
  @ApiResponse({ status: 403, description: '자신의 신청은 검토할 수 없음' })
  @ApiResponse({ status: 404, description: '플랫폼 신청을 찾을 수 없음' })
  @RequirePermission('admin.platform-applications.reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() admin: UserInfo
  ): Promise<void> {
    await this.platformApplicationService.rejectApplication(applicationId, dto, admin.id);
  }

  @Get('rejection-reasons')
  @ApiOperation({ summary: '플랫폼 신청 거부 사유 목록 조회 (관리자)' })
  @ApiResponse({
    status: 200,
    description: '거부 사유 목록 및 메시지 조회 성공',
    type: [RejectionReasonItemDto],
  })
  @RequirePermission('admin.platform-applications.read')
  @Serialize({ dto: RejectionReasonItemDto })
  async getRejectionReasons(): Promise<RejectionReasonItemDto[]> {
    return Object.values(RejectionReason).map(reason => ({
      code: reason,
      message: PlatformApplicationException.getRejectionReasonMessage(reason),
    }));
  }
}