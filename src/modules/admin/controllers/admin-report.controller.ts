import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';

import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiOkResponse,
  SwaggerApiPaginatedResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { ReportService, ReportStatisticsService, ReportReviewService } from '../../report/services/index.js';
import { ReportTargetType, ReportStatus } from '../../report/enums/index.js';
import { ReportSearchQueryDto, ReviewReportDto, ReportDetailDto } from '../../report/dto/index.js';
import { UpdatePriorityDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['admin-reports'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
@Controller('admin/reports')
export class AdminReportController {
  private readonly logger = new Logger(AdminReportController.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly statisticsService: ReportStatisticsService,
    private readonly reviewService: ReportReviewService,
  ) {}

  @Get()
  @SwaggerApiOperation({
    summary: '관리자용 신고 목록 조회',
    description: '관리자가 모든 신고 목록을 조회합니다. 상태별, 대상별 필터링을 지원합니다.',
  })
  @SwaggerApiPaginatedResponse({
    dto: ReportDetailDto,
    status: 200,
    description: '신고 목록 조회 성공',
  })
  @RequirePermission('report:read')
  async getAllReports(
    @Query() query: ReportSearchQueryDto
  ): Promise<PaginatedResult<ReportDetailDto>> {
    return await this.reportService.searchReports(query);
  }

  @Get('pending')
  @SwaggerApiOperation({
    summary: '검토 대기 중인 신고 목록',
    description: '우선순위와 생성시간 순으로 정렬된 검토 대기 중인 신고 목록을 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({
    dto: ReportDetailDto,
    status: 200,
    description: '대기 신고 목록 조회 성공',
  })
  @RequirePermission('report:read')
  async getPendingReports(
    @Query() query: Omit<ReportSearchQueryDto, 'status'>
  ): Promise<PaginatedResult<ReportDetailDto>> {
    const searchQuery: ReportSearchQueryDto = { ...query, status: ReportStatus.PENDING };
    return await this.reportService.searchReports(searchQuery);
  }

  @Get('statistics')
  @SwaggerApiOperation({
    summary: '신고 통계 조회',
    description: '전체 신고 통계 및 현황을 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신고 통계 조회 성공',
  })
  @RequirePermission('report:read')
  async getReportStatistics(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    reportsByTargetType: Array<{ targetType: string; count: number }>;
    reportsByStatus: Array<{ status: string; count: number }>;
  }> {
    return await this.statisticsService.getReportStatistics();
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '관리자용 신고 상세 조회',
    description: '관리자가 특정 신고의 상세 정보를 조회합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiOkResponse({ dto: ReportDetailDto, status: 200, description: '신고 상세 조회 성공' })
  @RequirePermission('report:read')
  async getReportById(@Param('id', ParseUUIDPipe) reportId: string): Promise<ReportDetailDto> {
    return await this.reportService.getReportById(reportId);
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '신고 검토 및 처리',
    description: '관리자가 신고를 검토하고 적절한 조치를 취합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiBody({ dto: ReviewReportDto })
  @SwaggerApiOkResponse({ status: 204, description: '신고 검토 완료' })
  @RequirePermission('report:write')
  async reviewReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: ReviewReportDto,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    await this.reviewService.reviewReport(reportId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '관리자용 신고 삭제',
    description: '관리자가 신고를 삭제합니다. 검토 완료된 신고는 삭제할 수 없습니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiOkResponse({ status: 204, description: '신고 삭제 완료' })
  @RequirePermission('report:delete')
  async deleteReport(@Param('id', ParseUUIDPipe) reportId: string): Promise<void> {
    await this.reportService.deleteReport(reportId);
  }

  @Get('user/:userId')
  @SwaggerApiOperation({
    summary: '특정 사용자의 신고 이력',
    description: '특정 사용자가 접수한 모든 신고 이력을 조회합니다.',
  })
  @SwaggerApiParam({ name: 'userId', type: String, description: '사용자 ID' })
  @SwaggerApiPaginatedResponse({
    dto: ReportDetailDto,
    status: 200,
    description: '사용자 신고 이력 조회 성공',
  })
  @RequirePermission('report:read')
  async getUserReports(
    @Param('userId') userId: string,
    @Query() query: Omit<ReportSearchQueryDto, 'reporterId'>
  ): Promise<PaginatedResult<ReportDetailDto>> {
    const searchQuery = { ...query, reporterId: userId };
    return await this.reportService.searchReports(searchQuery);
  }

  @Get('target/:targetType/:targetId')
  @SwaggerApiOperation({
    summary: '특정 대상에 대한 모든 신고',
    description: '특정 콘텐츠, 크리에이터, 또는 사용자에 대한 모든 신고를 조회합니다.',
  })
  @SwaggerApiParam({ name: 'targetType', type: String, description: '신고 대상 타입' })
  @SwaggerApiParam({ name: 'targetId', type: String, description: '신고 대상 ID' })
  @SwaggerApiPaginatedResponse({
    dto: ReportDetailDto,
    status: 200,
    description: '대상별 신고 목록 조회 성공',
  })
  @RequirePermission('report:read')
  async getTargetReports(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @Query() query: Omit<ReportSearchQueryDto, 'targetType' | 'targetId'>
  ): Promise<PaginatedResult<ReportDetailDto>> {
    const searchQuery = {
      ...query,
      targetType: targetType as ReportTargetType,
      targetId,
    };
    return await this.reportService.searchReports(searchQuery);
  }

  @Patch(':id/priority')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '신고 우선순위 변경',
    description: '관리자가 신고의 우선순위를 변경합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiBody({
    description: '우선순위 변경 정보',
    dto: UpdatePriorityDto,
  })
  @SwaggerApiOkResponse({ status: 204, description: '우선순위 변경 완료' })
  @RequirePermission('report:write')
  async updateReportPriority(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() body: UpdatePriorityDto
  ): Promise<void> {
    await this.reportService.findByIdOrFail(reportId); // 존재 확인

    // TODO: ReportService에 우선순위 업데이트 메서드 추가 필요
    this.logger.log('Report priority update requested', {
      reportId,
      newPriority: body.priority,
    });
  }
}
