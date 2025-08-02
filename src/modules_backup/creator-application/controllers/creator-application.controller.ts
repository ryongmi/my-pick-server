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
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { RequirePermission } from '@krgeobuk/authorization/decorators';

import { CreatorApplicationService } from '../services/index.js';
import { CreateApplicationDto, ReviewApplicationDto, ApplicationDetailDto } from '../dto/index.js';
import { ApplicationStatus } from '../enums/index.js';
import { PaginatedResult } from '../../creator/dto/index.js';

@SwaggerApiTags({ tags: ['creator-application'] })
@SwaggerApiBearerAuth()
@Controller('creator-application')
export class CreatorApplicationController {
  constructor(private readonly creatorApplicationService: CreatorApplicationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 신청' })
  @SwaggerApiBody({ dto: CreateApplicationDto })
  @SwaggerApiOkResponse({
    status: 201,
    description: '크리에이터 신청이 성공적으로 생성되었습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 데이터',
  })
  @SwaggerApiErrorResponse({
    status: 409,
    description: '이미 신청된 크리에이터입니다.',
  })
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<void> {
    dto.userId = id;

    await this.creatorApplicationService.createApplication(dto);
  }

  @Get('status')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '내 크리에이터 신청 상태 조회' })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 신청 상태 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 500,
    description: '신청 상태 조회 중 오류가 발생했습니다.',
  })
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationStatus(
    @CurrentJwt() { id }: JwtPayload
  ): Promise<ApplicationDetailDto | { status: 'none' }> {
    const application = await this.creatorApplicationService.getApplicationStatus(id);

    if (!application) {
      return { status: 'none' };
    }

    return application;
  }

  @Get(':id')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @SwaggerApiOperation({ summary: '크리에이터 신청 상세 조회' })
  @SwaggerApiParam({
    name: 'id',
    description: '크리에이터 신청 ID',
    type: String,
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '크리에이터 신청 상세 조회 성공',
    dto: ApplicationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '크리에이터 신청을 찾을 수 없습니다.',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '해당 신청에 대한 접근 권한이 없습니다.',
  })
  @Serialize({ dto: ApplicationDetailDto })
  async getApplicationById(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @CurrentJwt() { id }: JwtPayload
  ): Promise<ApplicationDetailDto> {
    return this.creatorApplicationService.getApplicationById(applicationId, id);
  }
}

