import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';

import { AuthenticatedJwt } from '@krgeobuk/jwt/interfaces';
import { CurrentJwt } from '@krgeobuk/jwt/decorators';
import { AccessTokenGuard, OptionalAccessTokenGuard } from '@krgeobuk/jwt/guards';

import { CreatorApplicationService } from '../services/creator-application.service.js';
import { CreateApplicationDto, ApplicationDetailDto } from '../dto/index.js';

@Controller('creator-applications')
export class CreatorApplicationController {
  constructor(private readonly applicationService: CreatorApplicationService) {}

  /**
   * 크리에이터 신청 제출
   */
  @Post()
  @UseGuards(AccessTokenGuard)
  async submitApplication(
    @CurrentJwt() { userId }: AuthenticatedJwt,
    @Body() dto: CreateApplicationDto
  ): Promise<{ applicationId: string }> {
    const applicationId = await this.applicationService.submitApplication(userId, dto);
    return { applicationId };
  }

  /**
   * 내 신청 상태 조회
   */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  async getMyApplication(
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<ApplicationDetailDto | { status: 'none' }> {
    const application = await this.applicationService.getMyApplicationStatus(userId);
    if (!application) {
      return { status: 'none' };
    }
    return application;
  }

  /**
   * 신청 상세 조회
   */
  @Get(':id')
  @UseGuards(AccessTokenGuard)
  async getApplication(
    @Param('id') id: string,
    @CurrentJwt() { userId }: AuthenticatedJwt
  ): Promise<ApplicationDetailDto> {
    return this.applicationService.getApplicationById(id, userId);
  }
}
