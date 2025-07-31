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
import { RequirePermission } from '@krgeobuk/authorization/decorators';

import { CreatorApplicationService } from '../../creator-application/services/index.js';
import { ReviewApplicationDto, ApplicationDetailDto } from '../../creator-application/dto/index.js';
import { ApplicationStatus } from '../../creator-application/enums/index.js';
import { PaginatedResult } from '../../creator/dto/index.js';

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
const RequirePermissionTemp = (permission: string) => () => {};

@SwaggerApiTags({ tags: ['admin/creator-applications'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
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
  // @RequirePermission('admin.creator-applications.read')
  async getApplications(
    @Query('status') status?: ApplicationStatus,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ): Promise<PaginatedResult<ApplicationDetailDto>> {
    const searchOptions: any = { page, limit };
    if (status !== undefined) {
      searchOptions.status = status;
    }
    
    return this.creatorApplicationService.searchApplicationsForAdmin(searchOptions) as any;
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
  // @RequirePermission('admin.creator-applications.stats')
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
  // @RequirePermission('admin.creator-applications.read')
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
  // @RequirePermission('admin.creator-applications.approve')
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
  // @RequirePermission('admin.creator-applications.reject')
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

