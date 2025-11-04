import { Controller, Post, Get, Param, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';

import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';

import { CreatorRegistrationService } from '../services/creator-registration.service.js';
import { CreateRegistrationDto, RegistrationDetailDto, ReviewRegistrationDto } from '../dto/index.js';
import { RegistrationStatus } from '../entities/creator-registration.entity.js';
import { CreatorRegistrationException } from '../exceptions/index.js';

@Controller('creator-registrations')
export class CreatorRegistrationController {
  constructor(private readonly registrationService: CreatorRegistrationService) {}

  /**
   * 크리에이터 신청 제출
   */
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
