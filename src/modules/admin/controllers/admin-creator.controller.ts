import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
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
import { AuthorizationGuard } from '@krgeobuk/authorization/guards';

import { CreatorService } from '../../creator/services';
import { UserSubscriptionService } from '../../user-subscription/services';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
  PaginatedResult,
} from '../../creator/dto';

// TODO: @krgeobuk/authorization 패키지 설치 후 import
// import { RequirePermission } from '@krgeobuk/authorization';

// 임시 데코레이터 (실제로는 @krgeobuk/authorization에서 import)
const RequirePermission = (permission: string) => () => {};

// 관리자 전용 크리에이터 상태 DTO
export class UpdateCreatorStatusDto {
  status: 'active' | 'inactive' | 'suspended';
  reason?: string;
}

// 관리자 전용 크리에이터 상세 DTO (추가 정보 포함)
export class AdminCreatorDetailDto extends CreatorDetailDto {
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'suspended';
  lastSyncAt?: Date;
  platformCount: number;
  subscriptionCount: number;
  contentCount: number;
  reportCount: number;
}

@SwaggerApiTags({ tags: ['admin-creators'] })
@SwaggerApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('admin/creators')
export class AdminCreatorController {
  constructor(
    private readonly creatorService: CreatorService,
    private readonly userSubscriptionService: UserSubscriptionService,
  ) {}

  @Get()
  @SwaggerApiOperation({ 
    summary: '관리자용 크리에이터 목록 조회',
    description: '관리자가 모든 크리에이터 목록을 조회합니다. 검색, 필터링, 페이지네이션을 지원합니다.'
  })
  @SwaggerApiPaginatedResponse(CreatorSearchResultDto)
  // @RequirePermission('admin.creator.read')
  async getCreators(
    @Query() query: CreatorSearchQueryDto,
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    return this.creatorService.searchCreators(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SwaggerApiOperation({ 
    summary: '관리자용 크리에이터 수동 생성',
    description: '관리자가 크리에이터를 수동으로 생성합니다. 크리에이터 신청 승인과 별개로 직접 생성할 때 사용합니다.'
  })
  @SwaggerApiBody({ type: CreateCreatorDto })
  @SwaggerApiCreatedResponse({ description: '크리에이터 생성 완료' })
  // @RequirePermission('admin.creator.create')
  async createCreator(@Body() dto: CreateCreatorDto): Promise<void> {
    await this.creatorService.createCreator(dto);
  }

  @Get(':id')
  @SwaggerApiOperation({ 
    summary: '관리자용 크리에이터 상세 조회',
    description: '관리자가 크리에이터의 상세 정보를 조회합니다. 일반 사용자 조회와 달리 관리용 추가 정보를 포함합니다.'
  })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({ type: AdminCreatorDetailDto })
  // @RequirePermission('admin.creator.read')
  async getCreatorById(
    @Param('id', ParseUUIDPipe) creatorId: string,
  ): Promise<AdminCreatorDetailDto> {
    // 관리자는 모든 정보를 볼 수 있음 (userId 없이 조회)
    const creator = await this.creatorService.getCreatorById(creatorId);
    const subscriptionCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    // TODO: 추가 관리자 정보 수집
    const adminDetail: AdminCreatorDetailDto = {
      ...creator,
      createdAt: new Date(), // TODO: 실제 생성일
      updatedAt: new Date(), // TODO: 실제 수정일
      status: 'active', // TODO: 실제 상태
      lastSyncAt: undefined, // TODO: 마지막 동기화 시간
      platformCount: 0, // TODO: 연결된 플랫폼 수
      subscriptionCount,
      contentCount: creator.contentCount,
      reportCount: 0, // TODO: 신고 수
    };

    return adminDetail;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '관리자용 크리에이터 정보 수정' })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiBody({ type: UpdateCreatorDto })
  @SwaggerApiNoContentResponse({ description: '크리에이터 수정 완료' })
  // @RequirePermission('admin.creator.update')
  async updateCreator(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: UpdateCreatorDto,
  ): Promise<void> {
    await this.creatorService.updateCreator(creatorId, dto);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ 
    summary: '크리에이터 상태 변경',
    description: '관리자가 크리에이터의 상태를 변경합니다 (활성/비활성/정지). 관리자 전용 기능입니다.'
  })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiBody({ type: UpdateCreatorStatusDto })
  @SwaggerApiNoContentResponse({ description: '상태 변경 완료' })
  // @RequirePermission('admin.creator.status.update')
  async updateCreatorStatus(
    @Param('id', ParseUUIDPipe) creatorId: string,
    @Body() dto: UpdateCreatorStatusDto,
  ): Promise<void> {
    // TODO: 크리에이터 상태 변경 로직 구현
    // 현재는 CreatorEntity에 status 필드가 없으므로 나중에 구현
    
    // 상태 변경 로그 (예시)
    console.log(`크리에이터 ${creatorId} 상태를 ${dto.status}로 변경, 사유: ${dto.reason}`);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @SwaggerApiOperation({ summary: '관리자용 크리에이터 삭제' })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiNoContentResponse({ description: '크리에이터 삭제 완료' })
  // @RequirePermission('admin.creator.delete')
  async deleteCreator(@Param('id', ParseUUIDPipe) creatorId: string): Promise<void> {
    await this.creatorService.deleteCreator(creatorId);
  }

  @Get(':id/statistics')
  @SwaggerApiOperation({ 
    summary: '크리에이터 상세 통계 (관리자용)',
    description: '관리자가 크리에이터의 상세한 통계 정보를 조회합니다. 일반 통계보다 더 많은 정보를 포함합니다.'
  })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    schema: {
      properties: {
        subscriberCount: { type: 'number' },
        followerCount: { type: 'number' },
        contentCount: { type: 'number' },
        totalViews: { type: 'number' },
        avgEngagementRate: { type: 'number' },
        weeklyGrowth: { type: 'number' },
        monthlyGrowth: { type: 'number' },
        topContent: { type: 'array' },
        recentActivity: { type: 'array' },
      },
    },
  })
  // @RequirePermission('admin.creator.statistics.read')
  async getCreatorStatistics(
    @Param('id', ParseUUIDPipe) creatorId: string,
  ): Promise<{
    subscriberCount: number;
    followerCount: number;
    contentCount: number;
    totalViews: number;
    avgEngagementRate: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
    topContent: any[];
    recentActivity: any[];
  }> {
    const creator = await this.creatorService.findByIdOrFail(creatorId);
    const subscriberCount = await this.userSubscriptionService.getSubscriberCount(creatorId);

    // TODO: 실제 통계 데이터 계산 로직 구현
    return {
      subscriberCount,
      followerCount: creator.followerCount,
      contentCount: creator.contentCount,
      totalViews: Number(creator.totalViews),
      avgEngagementRate: 5.2, // TODO: 실제 계산
      weeklyGrowth: 2.1, // TODO: 실제 계산
      monthlyGrowth: 8.5, // TODO: 실제 계산
      topContent: [], // TODO: 인기 콘텐츠 목록
      recentActivity: [], // TODO: 최근 활동 목록
    };
  }

  @Get(':id/platforms')
  @SwaggerApiOperation({ 
    summary: '크리에이터 플랫폼 목록 (관리자용)',
    description: '관리자가 크리에이터가 연결한 모든 플랫폼 목록과 동기화 상태를 조회합니다.'
  })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          platformId: { type: 'string' },
          url: { type: 'string' },
          followerCount: { type: 'number' },
          isActive: { type: 'boolean' },
          lastSyncAt: { type: 'string' },
          syncStatus: { type: 'string' },
        },
      },
    },
  })
  // @RequirePermission('admin.creator.platforms.read')
  async getCreatorPlatforms(
    @Param('id', ParseUUIDPipe) creatorId: string,
  ): Promise<any[]> {
    // TODO: CreatorPlatformService 구현 후 실제 데이터 반환
    await this.creatorService.findByIdOrFail(creatorId); // 존재 확인
    
    return []; // TODO: 실제 플랫폼 목록 반환
  }

  @Get(':id/reports')
  @SwaggerApiOperation({ 
    summary: '크리에이터 신고 목록 (관리자용)',
    description: '관리자가 특정 크리에이터에 대한 모든 신고 내역을 조회합니다. 신고 처리 상태도 함께 확인할 수 있습니다.'
  })
  @SwaggerApiParam({ name: 'id', description: '크리에이터 ID' })
  @SwaggerApiOkResponse({
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'string' },
          reportType: { type: 'string' },
          reason: { type: 'string' },
          reportedBy: { type: 'string' },
          status: { type: 'string' },
          createdAt: { type: 'string' },
        },
      },
    },
  })
  // @RequirePermission('admin.creator.reports.read')
  async getCreatorReports(
    @Param('id', ParseUUIDPipe) creatorId: string,
  ): Promise<any[]> {
    // TODO: ReportService 구현 후 실제 데이터 반환
    await this.creatorService.findByIdOrFail(creatorId); // 존재 확인
    
    return []; // TODO: 실제 신고 목록 반환
  }
}