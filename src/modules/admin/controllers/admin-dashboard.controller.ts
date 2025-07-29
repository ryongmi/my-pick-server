import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { AdminDashboardService } from '../services';
import {
  AdminDashboardOverviewDto,
  AdminDashboardStatsDto,
  AdminDashboardMetricsDto,
} from '../dto';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { AuthGuard, RequirePermission, CurrentUser } from '@krgeobuk/authorization';

// 임시 인터페이스 (실제로는 @krgeobuk/authorization에서 import)
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const AuthGuard = () => () => {};
const CurrentUser = () => (target: any, propertyKey: string, parameterIndex: number) => {};
const RequirePermission = (permission: string) => () => {};

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  @Get()
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.dashboard.read')
  async getDashboardOverview(
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminDashboardOverviewDto> {
    return this.adminDashboardService.getDashboardOverview();
  }

  @Get('stats')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.dashboard.stats')
  async getDashboardStats(
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminDashboardStatsDto> {
    return this.adminDashboardService.getDashboardStats();
  }

  @Get('metrics')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.dashboard.metrics')
  async getDashboardMetrics(
    // @CurrentUser() admin: UserInfo,
  ): Promise<AdminDashboardMetricsDto> {
    return this.adminDashboardService.getDashboardMetrics();
  }
}