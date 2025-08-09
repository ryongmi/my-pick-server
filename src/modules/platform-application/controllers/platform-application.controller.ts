import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
} from '@nestjs/common';

import { Serialize } from '@krgeobuk/core/decorators';
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
// import { CurrentUser } from '@krgeobuk/authorization/decorators';
// import { UserInfo } from '@krgeobuk/auth/interfaces';

// 임시 타입 정의
interface UserInfo {
  id: string;
  email: string;
  roles: string[];
}

// 임시 데코레이터
const CurrentUser = () => (target: unknown, propertyKey: string, parameterIndex: number) => {};

import { PlatformApplicationService } from '../services/index.js';
import {
  CreatePlatformApplicationDto,
  UpdatePlatformApplicationDto,
  ApplicationDetailDto,
  PlatformApplicationSearchQueryDto,
} from '../dto/index.js';

@SwaggerApiTags({ tags: ['platform-applications'] })
@SwaggerApiBearerAuth()
@Controller('platform-applications')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
export class PlatformApplicationController {
  constructor(private readonly platformApplicationService: PlatformApplicationService) {}

  @Post()
  @HttpCode(201)
  @SwaggerApiOperation({ summary: '플랫폼 추가 신청' })
  @SwaggerApiBody({ dto: CreatePlatformApplicationDto })
  @SwaggerApiOkResponse({
    status: 201,
    description: '플랫폼 신청이 성공적으로 생성되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 데이터',
  })
  @SwaggerApiErrorResponse({
    status: 409,
    description: '이미 존재하는 플랫폼 신청',
  })
  async createApplication(
    @Body() dto: CreatePlatformApplicationDto,
    @CurrentUser() user: UserInfo
  ): Promise<void> {
    await this.platformApplicationService.createApplication(dto, user.id);
  }

  @Get('my')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '내 플랫폼 신청 목록 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청 목록 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '플랫폼 신청 목록 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ApplicationDetailDto })
  async getMyApplications(@CurrentUser() user: UserInfo): Promise<ApplicationDetailDto[]> {
    const applications = await this.platformApplicationService.findByUserId(user.id);
    return applications.map((app) => ({
      id: app.id,
      creatorId: app.creatorId,
      userId: app.userId,
      status: app.status,
      platformType: app.platformType,
      appliedAt: app.appliedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      reviewedAt: app.reviewedAt,
      reviewerId: app.reviewerId,
    }));
  }

  @Get('creator/:creatorId')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '크리에이터별 내 플랫폼 신청 목록 조회' })
  @SwaggerApiParam({
    name: 'creatorId',
    description: '크리에이터 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터별 플랫폼 신청 목록 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터를 찾을 수 없습니다.',
  })
  @Serialize({ dto: ApplicationDetailDto })
  async getMyApplicationsByCreator(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @CurrentUser() user: UserInfo
  ): Promise<ApplicationDetailDto[]> {
    const applications = await this.platformApplicationService.findByCreatorId(creatorId);

    // 본인의 신청만 필터링
    const myApplications = applications.filter((app) => app.userId === user.id);

    return myApplications.map((app) => ({
      id: app.id,
      creatorId: app.creatorId,
      userId: app.userId,
      status: app.status,
      platformType: app.platformType,
      appliedAt: app.appliedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      reviewedAt: app.reviewedAt,
      reviewerId: app.reviewerId,
    }));
  }

  @Get(':id')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '플랫폼 신청 상세 조회' })
  @SwaggerApiParam({
    name: 'id',
    description: '플랫폼 신청 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청 상세 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼 신청을 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '해당 플랫폼 신청에 대한 접근 권한이 없습니다.',
  })
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationDetail(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: UserInfo
  ): Promise<ApplicationDetailDto> {
    const application = await this.platformApplicationService.findByIdOrFail(applicationId);

    // 본인의 신청인지 확인
    if (application.userId !== user.id) {
      throw new ForbiddenException('해당 플랫폼 신청에 대한 접근 권한이 없습니다.');
    }

    return await this.platformApplicationService.getApplicationDetail(applicationId);
  }

  @Patch(':id')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '플랫폼 신청 수정' })
  @SwaggerApiParam({
    name: 'id',
    description: '플랫폼 신청 ID',
    type: String,
  })
  @SwaggerApiBody({ dto: UpdatePlatformApplicationDto })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청이 성공적으로 수정되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 검토된 신청은 수정할 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '해당 플랫폼 신청에 대한 접근 권한이 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼 신청을 찾을 수 없습니다.',
  })
  async updateApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdatePlatformApplicationDto,
    @CurrentUser() user: UserInfo
  ): Promise<void> {
    await this.platformApplicationService.updateApplication(applicationId, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(200)
  @SwaggerApiOperation({ summary: '플랫폼 신청 취소' })
  @SwaggerApiParam({
    name: 'id',
    description: '플랫폼 신청 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '플랫폼 신청이 성공적으로 취소되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 검토된 신청은 취소할 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '해당 플랫폼 신청에 대한 접근 권한이 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '플랫폼 신청을 찾을 수 없습니다.',
  })
  async cancelApplication(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: UserInfo
  ): Promise<void> {
    await this.platformApplicationService.cancelApplication(applicationId, user.id);
  }
}
