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
  SwaggerApiCreatedResponse,
  SwaggerApiNoContentResponse,
  SwaggerApiPaginatedResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { CurrentUser } from '@krgeobuk/jwt/decorators';
import { Serialize } from '@krgeobuk/core/decorators';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import type { UserInfo } from '@krgeobuk/jwt/interfaces';

import { ReportService } from '../services/index.js';
import {
  CreateReportDto,
  ReportSearchQueryDto,
  ReportDetailDto,
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
    description: '사용자가 부적절한 콘텐츠, 크리에이터, 또는 다른 사용자를 신고합니다.',
  })
  @SwaggerApiBody({ dto: CreateReportDto })
  @SwaggerApiCreatedResponse({ status: 201, description: '신고가 성공적으로 접수되었습니다.' })
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: UserInfo,
  ): Promise<void> {
    await this.reportService.createReport(user.id, dto);
  }

  @Get()
  @SwaggerApiOperation({
    summary: '내 신고 목록 조회',
    description: '현재 사용자가 접수한 신고 목록을 조회합니다.',
  })
  @SwaggerApiPaginatedResponse({ dto: ReportDetailDto, status: 200, description: '신고 목록 조회 성공' })
  @Serialize(ReportDetailDto)
  async getMyReports(
    @Query() query: ReportSearchQueryDto,
    @CurrentUser() user: UserInfo,
  ): Promise<PaginatedResult<ReportDetailDto>> {
    // 자신이 신고한 내역만 조회
    const searchQuery = { ...query, reporterId: user.id };
    return await this.reportService.searchReports(searchQuery);
  }

  @Get(':id')
  @SwaggerApiOperation({
    summary: '신고 상세 조회',
    description: '특정 신고의 상세 정보를 조회합니다. 신고자 본인만 조회 가능합니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiOkResponse({ dto: ReportDetailDto, status: 200, description: '신고 상세 조회 성공' })
  @Serialize(ReportDetailDto)
  async getReportById(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: UserInfo,
  ): Promise<ReportDetailDto> {
    const report = await this.reportService.getReportById(reportId);
    
    // 신고자 본인만 조회 가능
    if (report.reporterId !== user.id) {
      this.logger.warn('Unauthorized report access attempt', {
        reportId,
        requesterId: user.id,
        reporterId: report.reporterId,
      });
      throw new Error('Access denied'); // TODO: ReportException 사용
    }

    return report;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({
    summary: '신고 삭제',
    description: '접수한 신고를 삭제합니다. 검토 중이거나 완료된 신고는 삭제할 수 없습니다.',
  })
  @SwaggerApiParam({ name: 'id', type: String, description: '신고 ID' })
  @SwaggerApiNoContentResponse({ status: 204, description: '신고 삭제 완료' })
  async deleteReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: UserInfo,
  ): Promise<void> {
    const report = await this.reportService.findByIdOrFail(reportId);
    
    // 신고자 본인만 삭제 가능
    if (report.reporterId !== user.id) {
      this.logger.warn('Unauthorized report deletion attempt', {
        reportId,
        requesterId: user.id,  
        reporterId: report.reporterId,
      });
      throw new Error('Access denied'); // TODO: ReportException 사용
    }

    await this.reportService.deleteReport(reportId);
  }

  @Get('target/:targetType/:targetId')
  @SwaggerApiOperation({
    summary: '특정 대상의 신고 현황 조회',
    description: '특정 콘텐츠, 크리에이터, 또는 사용자에 대한 신고 현황을 조회합니다.',
  })
  @SwaggerApiParam({ name: 'targetType', enum: ['user', 'creator', 'content'], description: '신고 대상 타입' })
  @SwaggerApiParam({ name: 'targetId', type: String, description: '신고 대상 ID' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신고 현황 조회 성공',
    schema: {
      type: 'object',
      properties: {
        totalReports: { type: 'number' },
        hasReportedByUser: { type: 'boolean' },
        mostCommonReason: { type: 'string' },
      },
    },
  })
  async getTargetReportStatus(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @CurrentUser() user: UserInfo,
  ): Promise<{
    totalReports: number;
    hasReportedByUser: boolean;
    mostCommonReason?: string;
  }> {
    // TODO: ReportService에 해당 메서드 추가 필요
    const reports = await this.reportService.searchReports({
      targetType: targetType as any,
      targetId,
      page: 1,
      limit: 100,
    });

    const hasReportedByUser = reports.items.some(report => report.reporterId === user.id);
    
    // 가장 많은 신고 사유 계산
    const reasonCounts: Record<string, number> = {};
    reports.items.forEach(report => {
      reasonCounts[report.reason] = (reasonCounts[report.reason] || 0) + 1;
    });
    
    const mostCommonReason = Object.keys(reasonCounts).length > 0
      ? Object.keys(reasonCounts).reduce((a, b) => reasonCounts[a] > reasonCounts[b] ? a : b)
      : undefined;

    return {
      totalReports: reports.pageInfo.totalItems,
      hasReportedByUser,
      mostCommonReason,
    };
  }
}