import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
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
import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { LimitType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { 
  CreatorApplicationService,
  CreatorApplicationOrchestrationService,
  CreatorApplicationStatisticsService 
} from '../../creator-application/services/index.js';
import { ReviewApplicationDto, ApplicationDetailDto } from '../../creator-application/dto/index.js';
import { ApplicationStatus } from '../../creator-application/enums/index.js';

@SwaggerApiTags({ tags: ['admin/creator-applications'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
@Controller('admin/creator-applications')
export class AdminCreatorApplicationController {
  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
    private readonly orchestrationService: CreatorApplicationOrchestrationService,
    private readonly statisticsService: CreatorApplicationStatisticsService
  ) {}

  @Get()
  @SwaggerApiOperation({
    summary: '크리에이터 신청 목록 조회 (관리자)',
    description: '관리자가 모든 크리에이터 신청서를 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({
    status: 200,
    description: '크리에이터 신청 목록 조회 성공',
    dto: ApplicationDetailDto,
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  async getApplications(
    @Query('status') status?: ApplicationStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    // Convert number limit to LimitType
    const limitType: LimitType =
      limit <= 15
        ? LimitType.FIFTEEN
        : limit <= 30
          ? LimitType.THIRTY
          : limit <= 50
            ? LimitType.FIFTY
            : LimitType.HUNDRED;

    const searchOptions: {
      page: number;
      limit: LimitType;
      status?: ApplicationStatus;
    } = { page, limit: limitType };
    if (status !== undefined) {
      searchOptions.status = status;
    }

    return this.statisticsService.searchApplicationsForAdmin(searchOptions);
  }

  @Get('stats')
  @SwaggerApiOperation({
    summary: '크리에이터 신청 통계 조회',
    description: '관리자가 크리에이터 신청 상태별 통계를 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신청 통계 조회 성공',
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    return this.statisticsService.getApplicationStats();
  }

  @Get(':userId')
  @SwaggerApiOperation({
    summary: '크리에이터 신청 상세 조회 (관리자)',
    description: '관리자가 특정 크리에이터 신청서를 상세 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'userId',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 신청 상세 조회 성공',
    dto: ApplicationDetailDto,
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:read')
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationById(
    @Param('userId', ParseUUIDPipe) applicationId: string
  ): Promise<ApplicationDetailDto> {
    // 관리자는 모든 신청서 조회 가능 (userId 검증 없음)
    return this.creatorApplicationService.getApplicationById(applicationId);
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({
    summary: '크리에이터 신청 승인',
    description: '관리자가 크리에이터 신청을 승인하고 Creator 엔티티를 생성합니다. 트랜잭션을 통해 데이터 일관성을 보장합니다.',
  })
  @SwaggerApiParam({
    name: 'userId',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiBody({
    dto: ReviewApplicationDto,
    description: '승인 정보',
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:approve')
  async approveApplication(
    @Param('userId', ParseUUIDPipe) applicationId: string,
    @Body() body: { comment?: string; requirements?: string[] },
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.userId 사용
    const reviewerId = userId; // JWT에서 관리자 ID 사용

    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.APPROVED,
      reviewerId,
      comment: body.comment || '',
      requirements: body.requirements || [],
    };

    await this.orchestrationService.reviewApplicationComplete(applicationId, dto, transactionManager);
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({
    summary: '크리에이터 신청 거부',
    description: '관리자가 크리에이터 신청을 거부하고 검토 데이터를 저장합니다. 트랜잭션을 통해 데이터 일관성을 보장합니다.',
  })
  @SwaggerApiParam({
    name: 'userId',
    description: '신청서 ID',
    type: String,
  })
  @SwaggerApiBody({
    dto: ReviewApplicationDto,
    description: '거부 정보',
  })
  // @UseGuards(AuthGuard)
  @RequirePermission('creator-application:reject')
  async rejectApplication(
    @Param('userId', ParseUUIDPipe) applicationId: string,
    @Body() body: { reason?: string; comment?: string; requirements?: string[] },
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.userId 사용
    const reviewerId = userId; // JWT에서 관리자 ID 사용

    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.REJECTED,
      reviewerId,
      reason: body.reason || '',
      comment: body.comment || '',
      requirements: body.requirements || [],
    };

    await this.orchestrationService.reviewApplicationComplete(applicationId, dto, transactionManager);
  }
}
