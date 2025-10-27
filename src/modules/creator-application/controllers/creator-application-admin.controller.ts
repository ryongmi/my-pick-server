import { Controller, Post, Get, Param, Body, Query, BadRequestException } from '@nestjs/common';

import { CreatorApplicationService } from '../services/creator-application.service.js';
import { ApplicationDetailDto, ReviewApplicationDto } from '../dto/index.js';
import { ApplicationStatus } from '../entities/creator-application.entity.js';
import { CreatorApplicationException } from '../exceptions/index.js';

@Controller('admin/creator-applications')
// TODO: Add AdminGuard when available
export class CreatorApplicationAdminController {
  constructor(private readonly applicationService: CreatorApplicationService) {}

  /**
   * 신청 목록 조회 (관리자)
   */
  @Get()
  async searchApplications(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<{ applications: ApplicationDetailDto[]; total: number }> {
    const searchOptions: {
      status?: ApplicationStatus;
      limit?: number;
      offset?: number;
    } = {};

    if (status) {
      searchOptions.status = status as ApplicationStatus;
    }
    if (limit) {
      searchOptions.limit = Number(limit);
    }
    if (offset) {
      searchOptions.offset = Number(offset);
    }

    return this.applicationService.searchApplications(searchOptions);
  }

  /**
   * 신청 통계 조회 (관리자)
   */
  @Get('stats')
  async getStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    return this.applicationService.getApplicationStats();
  }

  /**
   * 신청 검토 (승인/거부) - reviewerId는 JWT에서 추출 예정
   */
  @Post(':id/review')
  async reviewApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto & { reviewerId: string }
  ): Promise<{ creatorId?: string; message: string }> {
    // TODO: Get reviewerId from JWT token
    const reviewerId = dto.reviewerId || 'system';

    if (dto.status === ApplicationStatus.APPROVED) {
      const creatorId = await this.applicationService.approveApplication(
        id,
        reviewerId,
        dto.comment
      );
      return { creatorId, message: '신청이 승인되었습니다.' };
    } else if (dto.status === ApplicationStatus.REJECTED) {
      if (!dto.reason) {
        throw CreatorApplicationException.rejectionReasonRequired();
      }
      await this.applicationService.rejectApplication(id, reviewerId, dto.reason, dto.comment);
      return { message: '신청이 거부되었습니다.' };
    } else {
      throw new BadRequestException('Invalid status');
    }
  }
}
