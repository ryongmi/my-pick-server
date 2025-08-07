import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';
import { RequireRole, RequirePermission } from '@krgeobuk/authorization/decorators';

import { AdminDashboardService } from '../services/index.js';
import {
  AdminDashboardOverviewDto,
  AdminDashboardStatsDto,
  AdminDashboardMetricsDto,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['admin-dashboard'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRole('superAdmin')
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  @Get()
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '관리자 대시보드 개요 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '관리자 대시보드 개요 조회 성공',
    dto: AdminDashboardOverviewDto,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '관리자 권한이 필요합니다.',
  })
  @RequirePermission('dashboard:read')
  @Serialize({ dto: AdminDashboardOverviewDto })
  async getDashboardOverview(): Promise<AdminDashboardOverviewDto> {
    return this.adminDashboardService.getDashboardOverview();
  }

  @Get('stats')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '관리자 대시보드 통계 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '관리자 대시보드 통계 조회 성공',
    dto: AdminDashboardStatsDto,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '관리자 권한이 필요합니다.',
  })
  @RequirePermission('dashboard:read')
  @Serialize({ dto: AdminDashboardStatsDto })
  async getDashboardStats(): Promise<AdminDashboardStatsDto> {
    return this.adminDashboardService.getDashboardStats();
  }

  @Get('metrics')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '관리자 대시보드 메트릭 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '관리자 대시보드 메트릭 조회 성공',
    dto: AdminDashboardMetricsDto,
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '관리자 권한이 필요합니다.',
  })
  @RequirePermission('dashboard:read')
  @Serialize({ dto: AdminDashboardMetricsDto })
  async getDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
    return this.adminDashboardService.getDashboardMetrics();
  }
}