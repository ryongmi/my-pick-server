import {
  Controller,
  Get,
  Post,
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
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { Serialize } from '@krgeobuk/core/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type { JwtPayload } from '@krgeobuk/jwt/interfaces';

import { ReportService } from '../services/index.js';
import {
  CreateReportDto,
  ReportSearchQueryDto,
  ReportDetailDto,
  ReviewReportDto,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['reports'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('reports')
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  constructor(private readonly reportService: ReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SwaggerApiOperation({
    summary: '신고 접수',
    description: '새로운 신고를 접수합니다.',
  })
  @SwaggerApiBody({
    dto: CreateReportDto,
    description: '신고 정보',
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.CREATED,
    description: '신고가 성공적으로 접수되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 신고 데이터입니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.CONFLICT,
    description: '이미 동일한 대상에 대한 신고가 존재합니다.',
  })
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentJwt() { id: userId }: JwtPayload
  ): Promise<void> {
    this.logger.debug('Creating new report', {
      userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
    });

    await this.reportService.createReport(userId, dto);

    this.logger.log('Report created successfully', {
      userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
    });
  }

  @Get()
  @SwaggerApiOperation({
    summary: '신고 목록 조회',
    description: '신고 목록을 조회합니다. 관리자만 접근 가능합니다.',
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '신고 목록 조회 성공',
    dto: ReportDetailDto,
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('admin', 'superAdmin')
  @RequirePermission('reports:read')
  @Serialize({ dto: ReportDetailDto })
  async getReports(
    @Query() query: ReportSearchQueryDto
  ): Promise<PaginatedResult<ReportDetailDto>> {
    this.logger.debug('Fetching reports list', {
      page: query.page,
      limit: query.limit,
      status: query.status,
      targetType: query.targetType,
    });

    return await this.reportService.searchReports(query);
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '신고 상세 조회',
    description: '특정 신고의 상세 정보를 조회합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신고 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '신고 상세 정보 조회 성공',
    dto: ReportDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: '신고를 찾을 수 없습니다.',
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('admin', 'superAdmin')
  @RequirePermission('reports:read')
  @Serialize({ dto: ReportDetailDto })
  async getReportById(@Param('id', ParseUUIDPipe) reportId: string): Promise<ReportDetailDto> {
    this.logger.debug('Fetching report detail', { reportId });

    return await this.reportService.getReportById(reportId);
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '신고 검토',
    description: '신고를 검토하고 처리 결과를 기록합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신고 ID',
    type: String,
  })
  @SwaggerApiBody({
    dto: ReviewReportDto,
    description: '검토 정보',
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.NO_CONTENT,
    description: '신고 검토가 완료되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: '신고를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 상태 전환입니다.',
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('admin', 'superAdmin')
  @RequirePermission('reports:write')
  async reviewReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: ReviewReportDto,
    @CurrentJwt() { id: reviewerId }: JwtPayload
  ): Promise<void> {
    this.logger.debug('Reviewing report', {
      reportId,
      reviewerId,
      newStatus: dto.status,
    });

    await this.reportService.reviewReport(reportId, reviewerId, dto);

    this.logger.log('Report reviewed successfully', {
      reportId,
      reviewerId,
      newStatus: dto.status,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '신고 삭제',
    description: '처리되지 않은 신고를 삭제합니다.',
  })
  @SwaggerApiParam({
    name: 'id',
    description: '신고 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.NO_CONTENT,
    description: '신고가 성공적으로 삭제되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: '신고를 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '검토 완료된 신고는 삭제할 수 없습니다.',
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('superAdmin')
  @RequirePermission('reports:delete')
  async deleteReport(@Param('id', ParseUUIDPipe) reportId: string): Promise<void> {
    this.logger.debug('Deleting report', { reportId });

    await this.reportService.deleteReport(reportId);

    this.logger.log('Report deleted successfully', { reportId });
  }

  @Get('statistics/overview')
  @SwaggerApiOperation({
    summary: '신고 통계 조회',
    description: '신고 관련 통계 정보를 조회합니다.',
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '신고 통계 조회 성공',
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('admin', 'superAdmin')
  @RequirePermission('reports:read')
  async getReportStatistics(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    reportsThisMonth: number;
    reportsByTargetType: Array<{ targetType: string; count: number }>;
    reportsByStatus: Array<{ status: string; count: number }>;
    reportsByReason: Array<{ reason: string; count: number }>;
    reportTrends: Array<{ date: string; count: number }>;
  }> {
    this.logger.debug('Fetching report statistics');

    return await this.reportService.getReportStatistics();
  }

  @Post('batch/process')
  @HttpCode(HttpStatus.OK)
  @SwaggerApiOperation({
    summary: '신고 배치 처리',
    description: '대기 중인 신고들을 자동으로 처리합니다.',
  })
  @SwaggerApiOkResponse({
    status: HttpStatus.OK,
    description: '배치 처리 완료',
  })
  @UseGuards(AuthorizationGuard)
  @RequireRole('superAdmin')
  @RequirePermission('reports:write')
  async batchProcessReports(
    @Query('limit') limit?: number
  ): Promise<{ processed: number; failed: number }> {
    this.logger.debug('Starting batch report processing', { limit });

    const result = await this.reportService.batchProcessPendingReports(limit);

    this.logger.log('Batch processing completed', result);

    return result;
  }
}
