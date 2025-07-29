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

import { CreatorApplicationService } from '../services';
import {
  CreateApplicationDto,
  ReviewApplicationDto,
  ApplicationDetailDto,
} from '../dto';
import { ApplicationStatus } from '../entities';
import { PaginatedResult } from '../../creator/dto';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { AuthGuard, CurrentUser, RequirePermission } from '@krgeobuk/authorization';

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

@Controller('creator-application')
export class CreatorApplicationController {
  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(AuthGuard)
  async createApplication(
    @Body() dto: CreateApplicationDto,
    // @CurrentUser() user: UserInfo,
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 user.id 사용
    // dto.userId = user.id;
    dto.userId = 'temp-user-id'; // 임시
    
    await this.creatorApplicationService.createApplication(dto);
  }

  @Get('status')
  // @UseGuards(AuthGuard)
  async getApplicationStatus(
    // @CurrentUser() user: UserInfo,
  ): Promise<ApplicationDetailDto | { status: 'none' }> {
    // 실제로는 CurrentUser에서 가져온 user.id 사용
    const userId = 'temp-user-id'; // 임시
    
    const application = await this.creatorApplicationService.getApplicationStatus(userId);
    
    if (!application) {
      return { status: 'none' };
    }
    
    return application;
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  async getApplicationById(
    @Param('id', ParseUUIDPipe) applicationId: string,
    // @CurrentUser() user: UserInfo,
  ): Promise<ApplicationDetailDto> {
    // 실제로는 CurrentUser에서 가져온 user.id 사용
    const userId = 'temp-user-id'; // 임시
    
    return this.creatorApplicationService.getApplicationById(applicationId, userId);
  }
}

// 관리자 전용 컨트롤러
@Controller('admin/creator-applications')
export class AdminCreatorApplicationController {
  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
  ) {}

  @Get()
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.creator-applications.read')
  async getApplications(
    @Query('status') status?: ApplicationStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    return this.creatorApplicationService.searchApplicationsForAdmin({
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.creator-applications.stats')
  async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    return this.creatorApplicationService.getApplicationStats();
  }

  @Get(':id')
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.creator-applications.read')
  async getApplicationByIdForAdmin(
    @Param('id', ParseUUIDPipe) applicationId: string,
  ): Promise<ApplicationDetailDto> {
    // 관리자는 모든 신청서 조회 가능 (userId 검증 없음)
    return this.creatorApplicationService.getApplicationById(applicationId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.creator-applications.approve')
  async approveApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() body: { comment?: string; requirements?: string[] },
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.id 사용
    const reviewerId = 'temp-admin-id'; // 임시
    
    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.APPROVED,
      reviewerId,
      comment: body.comment,
      requirements: body.requirements,
    };

    await this.creatorApplicationService.reviewApplication(applicationId, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(AuthGuard)
  // @RequirePermission('admin.creator-applications.reject')
  async rejectApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() body: { reason?: string; comment?: string; requirements?: string[] },
    // @CurrentUser() admin: UserInfo,
  ): Promise<void> {
    // 실제로는 CurrentUser에서 가져온 admin.id 사용
    const reviewerId = 'temp-admin-id'; // 임시
    
    const dto: ReviewApplicationDto = {
      status: ApplicationStatus.REJECTED,
      reviewerId,
      reason: body.reason,
      comment: body.comment,
      requirements: body.requirements,
    };

    await this.creatorApplicationService.reviewApplication(applicationId, dto);
  }
}