import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { Serialize, TransactionManager } from '@krgeobuk/core/decorators';
import { TransactionInterceptor } from '@krgeobuk/core/interceptors';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiBearerAuth,
  SwaggerApiParam,
  SwaggerApiOkResponse,
  SwaggerApiBody,
  SwaggerApiErrorResponse,
} from '@krgeobuk/swagger/decorators';
import { AccessTokenGuard } from '@krgeobuk/jwt/guards';
import { JwtPayload } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';

import { CreatorApplicationService, CreatorApplicationOrchestrationService } from '../services/index.js';
import { CreateApplicationDto, ApplicationDetailDto } from '../dto/index.js';

@SwaggerApiTags({ tags: ['creator-application'] })
@SwaggerApiBearerAuth()
@Controller('creator-application')
export class CreatorApplicationController {
  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
    private readonly orchestrationService: CreatorApplicationOrchestrationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(TransactionInterceptor)
  @SwaggerApiOperation({ 
    summary: '크리에이터 신청',
    description: '크리에이터 신청서를 제출하고 정규화된 데이터를 저장합니다. 트랜잭션을 통해 데이터 일관성을 보장합니다.'
  })
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
    @CurrentJwt() { id }: JwtPayload,
    @TransactionManager() transactionManager: EntityManager
  ): Promise<{ applicationId: string }> {
    dto.userId = id;

    const applicationId = await this.orchestrationService.createApplicationComplete(dto, transactionManager);
    return { applicationId };
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
