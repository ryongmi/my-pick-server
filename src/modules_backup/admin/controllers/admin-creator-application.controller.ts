import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
  SwaggerApiBody,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { LimitType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorApplicationService } from '../../creator-application/services/index.js';
import { ReviewApplicationDto, ApplicationDetailDto } from '../../creator-application/dto/index.js';
import { ApplicationStatus } from '../../creator-application/enums/index.js';


@SwaggerApiTags({ tags: ['admin/creator-applications'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
@Controller('admin/creator-applications')
export class AdminCreatorApplicationController {
  constructor(private readonly creatorApplicationService: CreatorApplicationService) {}

  @Get()
  @SwaggerApiOperation({
    summary: '크리에이터 신청 목록 조회 (관리자)',
    description: '관리자가 모든 크리에이터 신청서를 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({ 
    status: 200,
    description: '크리에이터 신청 목록 조회 성공',
    dto: ApplicationDetailDto 
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  async getApplications(
    @Query('status') status?: ApplicationStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    // Convert number limit to LimitType
    const limitType: LimitType = limit <= 15 ? LimitType.FIFTEEN :
                                 limit <= 30 ? LimitType.THIRTY :
                                 limit <= 50 ? LimitType.FIFTY :
                                 LimitType.HUNDRED;
                                 
    const searchOptions: {
      page: number;
      limit: LimitType;
      status?: ApplicationStatus;
    } = { page, limit: limitType };
    if (status !== undefined) {
      searchOptions.status = status;
    }
    
    return this.creatorApplicationService.searchApplicationsForAdmin(searchOptions);
  }

  @Get('stats')
  @SwaggerApiOperation({
    summary: '크리에이터 신청 통계 조회',
    description: '관리자가 크리에이터 신청 상태별 통계를 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신청 통계 조회 성공'
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    return this.creatorApplicationService.getApplicationStats();
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '크리에이터 신청 상세 조회 (관리자)',
    description: '관리자가 특정 크리에이터 신청서를 상세 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiOkResponse({ 
    status: 200,
    description: '크리에이터 신청 상세 조회 성공',
    dto: ApplicationDetailDto 
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationById(
    @Param('id', ParseUUIDPipe) applicationId: string
  ): Promise<ApplicationDetailDto> {
    // 관리자는 모든 신청서 조회 가능 (userId 검증 없음)
    return this.creatorApplicationService.getApplicationById(applicationId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '크리에이터 신청 승인',
    description: '관리자가 크리에이터 신청을 승인합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiBody({
    dto: ReviewApplicationDto,
    description: '승인 정보'
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:approve')
  async approveApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() body: { comment?: string; requirements?: string[] },
    @CurrentJwt() { id }: JwtPayload
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.id 사용
    const reviewerId = id; // JWT에서 관리자 ID 사용

    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.APPROVED,
      reviewerId,
      comment: body.comment || '',
      requirements: body.requirements || [],
    };

    await this.creatorApplicationService.reviewApplication(applicationId, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '크리에이터 신청 거부',
    description: '관리자가 크리에이터 신청을 거부합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiBody({
    dto: ReviewApplicationDto,
    description: '거부 정보'
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() body: { reason?: string; comment?: string; requirements?: string[] },
    @CurrentJwt() { id }: JwtPayload
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.id 사용
    const reviewerId = id; // JWT에서 관리자 ID 사용

    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.REJECTED,
      reviewerId,
      reason: body.reason || '',
      comment: body.comment || '',
      requirements: body.requirements || [],
    };

    await this.creatorApplicationService.reviewApplication(applicationId, dto);
  }
}

