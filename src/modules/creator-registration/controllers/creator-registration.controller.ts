import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';
import {
  SwaggerApiTags,
  SwaggerApiOperation,
  SwaggerApiOkResponse,
  SwaggerApiErrorResponse,
  SwaggerApiParam,
  SwaggerApiBody,
  SwaggerApiBearerAuth,
} from '@krgeobuk/swagger';

import { CreatorRegistrationService } from '../services/creator-registration.service.js';
import {
  CreateRegistrationDto,
  RegistrationDetailDto,
  ReviewRegistrationDto,
} from '../dto/index.js';
import { RegistrationStatus } from '../enums/index.js';
import { CreatorRegistrationException } from '../exceptions/index.js';

@SwaggerApiTags({ tags: ['creator-registrations'] })
@Controller('creator-registrations')
export class CreatorRegistrationController {
  constructor(private readonly registrationService: CreatorRegistrationService) {}

  /**
   * 크리에이터 신청 제출
   */
  @SwaggerApiOperation({
    summary: '크리에이터 신청 제출',
    description: '새로운 크리에이터 등록 신청을 제출합니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiBody({
    dto: CreateRegistrationDto,
    description: '크리에이터 신청 정보',
  })
  @SwaggerApiOkResponse({
    status: 201,
    description: '신청 제출 성공 (응답: { registrationId: string })',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '이미 신청 중이거나 잘못된 요청',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Post()
  @UseGuards(AccessTokenGuard)
  async submitRegistration(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Body() dto: CreateRegistrationDto
  ): Promise<{ registrationId: string }> {
    const registrationId = await this.registrationService.submitRegistration(userId, dto);
    return { registrationId };
  }

  /**
   * 내 신청 상태 조회
   */
  @SwaggerApiOperation({
    summary: '내 신청 상태 조회',
    description: '현재 로그인한 사용자의 크리에이터 신청 상태를 조회합니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiOkResponse({
    status: 200,
    description: '신청 상태 조회 성공',
    dto: RegistrationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @Get('me')
  @UseGuards(AccessTokenGuard)
  async getMyRegistration(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<RegistrationDetailDto | { status: 'none' }> {
    const registration = await this.registrationService.getMyRegistrationStatus(userId);
    if (!registration) {
      return { status: 'none' };
    }
    return registration;
  }

  /**
   * 신청 목록 조회
   * TODO: Add AdminGuard when available
   */
  @SwaggerApiOperation({
    summary: '신청 목록 조회',
    description: '크리에이터 신청 목록을 조회합니다. (관리자용)',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description:
      '신청 목록 조회 성공 (응답: { registrations: RegistrationDetailDto[], total: number })',
  })
  @Get()
  async searchRegistrations(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<{ registrations: RegistrationDetailDto[]; total: number }> {
    const searchOptions: {
      status?: RegistrationStatus;
      limit?: number;
      offset?: number;
    } = {};

    if (status) {
      searchOptions.status = status as RegistrationStatus;
    }
    if (limit) {
      searchOptions.limit = Number(limit);
    }
    if (offset) {
      searchOptions.offset = Number(offset);
    }

    return this.registrationService.searchRegistrations(searchOptions);
  }

  /**
   * 신청 통계 조회
   * TODO: Add AdminGuard when available
   */
  @SwaggerApiOperation({
    summary: '신청 통계 조회',
    description: '크리에이터 신청 통계를 조회합니다. (관리자용)',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description:
      '통계 조회 성공 (응답: { pending: number, approved: number, rejected: number, total: number })',
  })
  @Get('stats')
  async getStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    return this.registrationService.getRegistrationStats();
  }

  /**
   * 신청 상세 조회
   */
  @SwaggerApiOperation({
    summary: '신청 상세 조회',
    description: '특정 크리에이터 신청의 상세 정보를 조회합니다.',
  })
  @SwaggerApiBearerAuth()
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '신청 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '신청 상세 조회 성공',
    dto: RegistrationDetailDto,
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '신청을 찾을 수 없습니다',
  })
  @SwaggerApiErrorResponse({
    status: 401,
    description: '인증이 필요합니다',
  })
  @SwaggerApiErrorResponse({
    status: 403,
    description: '다른 사용자의 신청을 조회할 수 없습니다',
  })
  @Get(':id')
  @UseGuards(AccessTokenGuard)
  async getRegistration(
    @Param('id') id: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<RegistrationDetailDto> {
    return this.registrationService.getRegistrationById(id, userId);
  }

  /**
   * 신청 검토 (승인/거부)
   * TODO: Add AdminGuard when available
   * TODO: Get reviewerId from JWT token
   */
  @SwaggerApiOperation({
    summary: '신청 검토 (승인/거부)',
    description: '크리에이터 신청을 승인하거나 거부합니다. (관리자용)',
  })
  @SwaggerApiParam({
    name: 'id',
    type: String,
    description: '신청 ID',
    required: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiBody({
    dto: ReviewRegistrationDto,
    description: '검토 정보',
  })
  @SwaggerApiOkResponse({
    status: 200,
    description: '검토 완료 (응답: { creatorId?: string, message: string })',
  })
  @SwaggerApiErrorResponse({
    status: 400,
    description: '잘못된 요청 (거부 시 사유 필수)',
  })
  @SwaggerApiErrorResponse({
    status: 404,
    description: '신청을 찾을 수 없습니다',
  })
  @Post(':id/review')
  async reviewRegistration(
    @Param('id') id: string,
    @Body() dto: ReviewRegistrationDto & { reviewerId: string }
  ): Promise<{ creatorId?: string; message: string }> {
    // TODO: Get reviewerId from JWT token
    const reviewerId = dto.reviewerId || 'system';

    if (dto.status === RegistrationStatus.APPROVED) {
      const creatorId = await this.registrationService.approveRegistration(
        id,
        reviewerId,
        dto.comment
      );
      return { creatorId, message: '신청이 승인되었습니다.' };
    } else if (dto.status === RegistrationStatus.REJECTED) {
      if (!dto.reason) {
        throw CreatorRegistrationException.rejectionReasonRequired();
      }
      await this.registrationService.rejectRegistration(id, reviewerId, dto.reason, dto.comment);
      return { message: '신청이 거부되었습니다.' };
    } else {
      throw new BadRequestException('Invalid status');
    }
  }
}

