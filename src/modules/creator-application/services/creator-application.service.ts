import { Injectable, Logger } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { PlatformType as CommonPlatformType } from '@common/enums/index.js';

import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { YouTubeApiService } from '../../external-api/services/youtube-api.service.js';
import { CreatorApplicationRepository } from '../repositories/creator-application.repository.js';
import {
  CreatorApplicationEntity,
  PlatformType,
  ApplicationStatus,
} from '../entities/creator-application.entity.js';
import { CreateApplicationDto, ApplicationDetailDto } from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';

@Injectable()
export class CreatorApplicationService {
  private readonly logger = new Logger(CreatorApplicationService.name);

  constructor(
    private readonly applicationRepo: CreatorApplicationRepository,
    private readonly youtubeApi: YouTubeApiService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly dataSource: DataSource
  ) {}

  // ==================== PUBLIC METHODS (사용자) ====================

  /**
   * 크리에이터 신청 제출
   */
  async submitApplication(userId: string, dto: CreateApplicationDto): Promise<string> {
    // 1. 중복 신청 체크 (PENDING 상태만)
    const hasActive = await this.applicationRepo.hasActiveApplication(userId);
    if (hasActive) {
      throw CreatorApplicationException.activeApplicationExists();
    }

    // 2. YouTube API로 채널 정보 검증 (실제 존재하는 채널인지)
    if (dto.platform === PlatformType.YOUTUBE) {
      const channelInfo = await this.youtubeApi.getChannelInfo(dto.channelId);
      if (!channelInfo) {
        throw CreatorApplicationException.channelNotFound();
      }

      // 3. 이미 등록된 채널인지 확인
      const existingPlatform = await this.creatorPlatformService.findByPlatformTypeAndId(
        CommonPlatformType.YOUTUBE as any,
        dto.channelId
      );
      if (existingPlatform) {
        throw CreatorApplicationException.channelAlreadyRegistered();
      }

      // 4. 신청 엔티티 생성 (YouTube 데이터 포함)
      const channelData: any = {
        platform: dto.platform,
        channelId: dto.channelId,
        channelUrl: dto.channelUrl,
        channelName: channelInfo.title,
        subscriberCount: channelInfo.statistics.subscriberCount,
        videoCount: channelInfo.statistics.videoCount,
        description: channelInfo.description,
      };

      if (channelInfo.thumbnails.high || channelInfo.thumbnails.medium) {
        channelData.thumbnailUrl = channelInfo.thumbnails.high || channelInfo.thumbnails.medium;
      }
      if (channelInfo.customUrl) {
        channelData.customUrl = channelInfo.customUrl;
      }
      if (channelInfo.brandingSettings.country) {
        channelData.country = channelInfo.brandingSettings.country;
      }
      channelData.publishedAt = channelInfo.publishedAt.toISOString();

      const applicationData: any = {
        userId,
        channelInfo: channelData,
        status: ApplicationStatus.PENDING,
        appliedAt: new Date(),
      };

      if (dto.applicantMessage) {
        applicationData.applicantMessage = dto.applicantMessage;
      }

      const application = this.applicationRepo.create(applicationData);
      const saved = await this.applicationRepo.save(application);
      const savedEntity = (Array.isArray(saved) ? saved[0] : saved) as CreatorApplicationEntity;

      this.logger.log('Creator application submitted', {
        applicationId: savedEntity.id,
        userId,
        channelId: dto.channelId,
        channelName: channelInfo.title,
      });

      return savedEntity.id;
    }

    throw CreatorApplicationException.platformNotSupported();
  }

  /**
   * 사용자의 활성 신청 조회 (PENDING만)
   */
  async findActiveApplication(userId: string): Promise<CreatorApplicationEntity | null> {
    return this.applicationRepo.findOne({
      where: { userId, status: ApplicationStatus.PENDING },
    });
  }

  /**
   * 신청 상태 조회 (사용자)
   */
  async getMyApplicationStatus(userId: string): Promise<ApplicationDetailDto | null> {
    const application = await this.applicationRepo.findLatestByUserId(userId);

    return application;
  }

  /**
   * 신청 상세 조회 (권한 체크 포함)
   */
  async getApplicationById(
    applicationId: string,
    requestUserId: string
  ): Promise<ApplicationDetailDto> {
    const application = await this.findByIdOrFail(applicationId);

    // 본인 신청만 조회 가능
    if (application.userId !== requestUserId) {
      throw CreatorApplicationException.notApplicationOwner();
    }

    return application;
  }

  // ==================== PUBLIC METHODS (관리자) ====================

  /**
   * 신청 승인 (트랜잭션)
   */
  async approveApplication(
    applicationId: string,
    reviewerId: string,
    comment?: string
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager.findOne(CreatorApplicationEntity, {
        where: { id: applicationId },
      });

      if (!application) {
        throw CreatorApplicationException.applicationNotFound();
      }

      if (application.status !== ApplicationStatus.PENDING) {
        throw CreatorApplicationException.applicationAlreadyReviewed();
      }

      const channelInfo = application.channelInfo;

      // 1. Creator 생성 (CreatorService의 createFromApplication 사용)
      const creator = await this.creatorService.createFromApplication(
        application.userId,
        applicationId,
        channelInfo
      );

      // 2. CreatorPlatform 생성
      const platformData: any = {
        creatorId: creator.id,
        platformType: CommonPlatformType.YOUTUBE,
        platformId: channelInfo.channelId,
        isActive: true,
      };

      if (channelInfo.customUrl !== undefined) {
        platformData.platformUsername = channelInfo.customUrl;
      }
      if (channelInfo.channelUrl !== undefined) {
        platformData.platformUrl = channelInfo.channelUrl;
      }

      await this.creatorPlatformService.createPlatform(platformData);

      // 3. 신청 상태 업데이트
      application.status = ApplicationStatus.APPROVED;

      const reviewInfoData: any = {
        reviewerId,
        reviewedAt: new Date().toISOString(),
      };
      if (comment) {
        reviewInfoData.comment = comment;
      }
      application.reviewInfo = reviewInfoData;

      await manager.save(application);

      this.logger.log('Creator application approved', {
        applicationId,
        creatorId: creator.id,
        reviewerId,
      });

      return creator.id;
    });
  }

  /**
   * 신청 거부
   */
  async rejectApplication(
    applicationId: string,
    reviewerId: string,
    reason: string,
    comment?: string
  ): Promise<void> {
    const application = await this.findByIdOrFail(applicationId);

    if (application.status !== ApplicationStatus.PENDING) {
      throw CreatorApplicationException.applicationAlreadyReviewed();
    }

    application.status = ApplicationStatus.REJECTED;

    const reviewInfoData: any = {
      reviewerId,
      reviewedAt: new Date().toISOString(),
      reason,
    };
    if (comment) {
      reviewInfoData.comment = comment;
    }
    application.reviewInfo = reviewInfoData;

    await this.applicationRepo.save(application);

    this.logger.log('Creator application rejected', {
      applicationId,
      reviewerId,
      reason,
    });
  }

  /**
   * 신청 목록 조회 (관리자, 페이지네이션)
   */
  async searchApplications(options: {
    status?: ApplicationStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ applications: CreatorApplicationEntity[]; total: number }> {
    const [applications, total] = await this.applicationRepo.searchApplications(options);

    return { applications, total };
  }

  /**
   * 신청 통계 조회 (관리자)
   */
  async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const pending = await this.applicationRepo.countByStatus(ApplicationStatus.PENDING);
    const approved = await this.applicationRepo.countByStatus(ApplicationStatus.APPROVED);
    const rejected = await this.applicationRepo.countByStatus(ApplicationStatus.REJECTED);

    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  async findByIdOrFail(id: string): Promise<CreatorApplicationEntity> {
    const application = await this.applicationRepo.findOne({ where: { id } });
    if (!application) {
      throw CreatorApplicationException.applicationNotFound();
    }
    return application;
  }
}
