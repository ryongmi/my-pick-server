import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CreatorApplicationService } from '../services';
import {
  CreateApplicationDto,
  ReviewApplicationDto,
  ApplicationDetailDto,
} from '../dto';
import { ApplicationStatus } from '../entities';

@Controller()
export class CreatorApplicationTcpController {
  private readonly logger = new Logger(CreatorApplicationTcpController.name);

  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
  ) {}

  // ==================== 조회 패턴 ====================

  @MessagePattern('creatorApplication.findById')
  async findById(@Payload() data: { applicationId: string }) {
    this.logger.debug(`TCP application detail request: ${data.applicationId}`);
    return await this.creatorApplicationService.findById(data.applicationId);
  }

  @MessagePattern('creatorApplication.findByUserId')
  async findByUserId(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP user application request: ${data.userId}`);
    return await this.creatorApplicationService.findByUserId(data.userId);
  }

  @MessagePattern('creatorApplication.getDetail')
  async getDetail(
    @Payload() data: { applicationId: string; requestUserId?: string },
  ) {
    this.logger.debug('TCP application detail request', {
      applicationId: data.applicationId,
      hasRequestUserId: !!data.requestUserId,
    });
    return await this.creatorApplicationService.getApplicationById(
      data.applicationId,
      data.requestUserId,
    );
  }

  @MessagePattern('creatorApplication.getStatus')
  async getStatus(@Payload() data: { userId: string }) {
    this.logger.debug(`TCP application status request: ${data.userId}`);
    return await this.creatorApplicationService.getApplicationStatus(data.userId);
  }

  // ==================== 변경 패턴 ====================

  @MessagePattern('creatorApplication.create')
  async create(@Payload() dto: CreateApplicationDto) {
    this.logger.log('TCP application creation request', {
      userId: dto.userId,
      platform: dto.channelInfo.platform,
      subscriberCount: dto.subscriberCount,
    });
    return await this.creatorApplicationService.createApplication(dto);
  }

  @MessagePattern('creatorApplication.review')
  async review(
    @Payload() data: { applicationId: string; reviewData: ReviewApplicationDto },
  ) {
    this.logger.log('TCP application review request', {
      applicationId: data.applicationId,
      status: data.reviewData.status,
      reviewerId: data.reviewData.reviewerId,
    });
    return await this.creatorApplicationService.reviewApplication(
      data.applicationId,
      data.reviewData,
    );
  }

  // ==================== 관리자 전용 패턴 ====================

  @MessagePattern('creatorApplication.searchForAdmin')
  async searchForAdmin(
    @Payload() data: {
      status?: ApplicationStatus;
      page?: number;
      limit?: number;
    },
  ) {
    this.logger.debug('TCP admin applications search request', {
      status: data.status,
      page: data.page,
      limit: data.limit,
    });
    return await this.creatorApplicationService.searchApplicationsForAdmin(data);
  }

  @MessagePattern('creatorApplication.getStats')
  async getStats(@Payload() data: {}) {
    this.logger.debug('TCP application stats request');
    return await this.creatorApplicationService.getApplicationStats();
  }

  @MessagePattern('creatorApplication.approve')
  async approve(
    @Payload() data: {
      applicationId: string;
      reviewerId: string;
      comment?: string;
      requirements?: string[];
    },
  ) {
    this.logger.log('TCP application approval request', {
      applicationId: data.applicationId,
      reviewerId: data.reviewerId,
    });

    const reviewData: ReviewApplicationDto = {
      status: ApplicationStatus.APPROVED,
      reviewerId: data.reviewerId,
      comment: data.comment,
      requirements: data.requirements,
    };

    return await this.creatorApplicationService.reviewApplication(
      data.applicationId,
      reviewData,
    );
  }

  @MessagePattern('creatorApplication.reject')
  async reject(
    @Payload() data: {
      applicationId: string;
      reviewerId: string;
      reason?: string;
      comment?: string;
      requirements?: string[];
    },
  ) {
    this.logger.log('TCP application rejection request', {
      applicationId: data.applicationId,
      reviewerId: data.reviewerId,
      hasReason: !!data.reason,
    });

    const reviewData: ReviewApplicationDto = {
      status: ApplicationStatus.REJECTED,
      reviewerId: data.reviewerId,
      reason: data.reason,
      comment: data.comment,
      requirements: data.requirements,
    };

    return await this.creatorApplicationService.reviewApplication(
      data.applicationId,
      reviewData,
    );
  }
}