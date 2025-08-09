import { Injectable, Logger, HttpException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EntityManager } from 'typeorm';

import { plainToInstance } from 'class-transformer';

import { LimitType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { PlatformType } from '@common/enums/index.js';

import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
} from '../repositories/index.js';
import { CreatorApplicationEntity } from '../entities/index.js';
import { ApplicationStatus } from '../enums/index.js';
import {
  CreateApplicationDto,
  ReviewApplicationDto,
  ApplicationDetailDto,
  NormalizedApplicationDetailDto,
} from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { CreateCreatorDto } from '../../creator/dto/index.js';

@Injectable()
export class CreatorApplicationService {
  private readonly logger = new Logger(CreatorApplicationService.name);

  constructor(
    private readonly applicationRepo: CreatorApplicationRepository,
    private readonly channelInfoRepo: CreatorApplicationChannelInfoRepository,
    private readonly sampleVideoRepo: CreatorApplicationSampleVideoRepository,
    private readonly reviewRepo: CreatorApplicationReviewRepository,
    private readonly creatorService: CreatorService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들 (BaseRepository 직접 사용)
  async findById(applicationId: string): Promise<CreatorApplicationEntity | null> {
    return this.applicationRepo.findOneById(applicationId);
  }

  async findByIdOrFail(applicationId: string): Promise<CreatorApplicationEntity> {
    const application = await this.findById(applicationId);
    if (!application) {
      this.logger.warn('Application not found', { applicationId });
      throw CreatorApplicationException.applicationNotFound();
    }
    return application;
  }

  async findByUserId(userId: string): Promise<CreatorApplicationEntity | null> {
    return this.applicationRepo.findOne({
      where: { userId },
      order: { appliedAt: 'DESC' },
    });
  }

  // 복합 조회 메서드들
  async getApplicationById(
    applicationId: string,
    requestUserId?: string
  ): Promise<ApplicationDetailDto> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 권한 확인 (신청자 본인만 조회 가능, 관리자는 별도 API)
      if (requestUserId && application.userId !== requestUserId) {
        this.logger.warn('Unauthorized application access attempt', {
          applicationId,
          requestUserId,
          applicationUserId: application.userId,
        });
        throw CreatorApplicationException.notApplicationOwner();
      }

      const detailDto = plainToInstance(ApplicationDetailDto, application, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Application detail fetched', {
        applicationId,
        requestUserId,
        status: application.status,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Application detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        requestUserId,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async getApplicationStatus(userId: string): Promise<ApplicationDetailDto | null> {
    try {
      const application = await this.findByUserId(userId);

      if (!application) {
        return null;
      }

      const detailDto = plainToInstance(ApplicationDetailDto, application, {
        excludeExtraneousValues: true,
      });

      this.logger.debug('Application status fetched', {
        userId,
        status: application.status,
        applicationId: application.id,
      });

      return detailDto;
    } catch (error: unknown) {
      this.logger.error('Application status fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  // 정규화된 데이터 조회 메서드
  async getNormalizedApplicationById(
    applicationId: string,
    requestUserId?: string
  ): Promise<NormalizedApplicationDetailDto> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 권한 확인 (신청자 본인만 조회 가능, 관리자는 별도 API)
      if (requestUserId && application.userId !== requestUserId) {
        this.logger.warn('Unauthorized application access attempt', {
          applicationId,
          requestUserId,
          applicationUserId: application.userId,
        });
        throw CreatorApplicationException.notApplicationOwner();
      }

      // 정규화된 데이터 조회
      const [channelInfo, sampleVideos, review] = await Promise.all([
        this.channelInfoRepo.findByApplicationId(applicationId),
        this.sampleVideoRepo.findByApplicationId(applicationId),
        this.reviewRepo.findByApplicationId(applicationId),
      ]);

      const detailDto = plainToInstance(
        NormalizedApplicationDetailDto,
        {
          ...application,
          channelInfo,
          sampleVideos,
          review,
        },
        {
          excludeExtraneousValues: true,
        }
      );

      this.logger.debug('Normalized application detail fetched', {
        applicationId,
        requestUserId,
        status: application.status,
        hasChannelInfo: !!channelInfo,
        sampleVideoCount: sampleVideos?.length || 0,
        hasReview: !!review,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Normalized application detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        requestUserId,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createApplication(dto: CreateApplicationDto): Promise<void> {
    try {
      // 1. 활성 신청 존재 확인 (authz-server 패턴)
      const existingApplication = await this.applicationRepo.findOne({
        where: {
          userId: dto.userId,
          status: ApplicationStatus.PENDING,
        },
      });

      if (existingApplication) {
        this.logger.warn('Active application already exists', {
          userId: dto.userId,
          existingApplicationId: existingApplication.id,
        });
        throw CreatorApplicationException.activeApplicationExists();
      }

      // 2. 메인 신청서 엔티티 생성 (JSON 컬럼 제거)
      const application = new CreatorApplicationEntity();
      Object.assign(application, {
        userId: dto.userId,
        status: ApplicationStatus.PENDING,
      });

      // 3. 저장 (BaseRepository 직접 사용)
      const savedApplication = await this.applicationRepo.saveEntity(application);

      // 4. 정규화된 데이터 저장
      await this.saveNormalizedApplicationData(savedApplication.id, dto);

      // 5. 성공 로깅
      this.logger.log('Creator application created successfully', {
        applicationId: savedApplication.id,
        userId: dto.userId,
        platform: dto.channelInfo.platform,
        subscriberCount: dto.subscriberCount,
        category: dto.contentCategory,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Application creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        platform: dto.channelInfo.platform,
      });

      throw CreatorApplicationException.applicationCreateError();
    }
  }

  async reviewApplication(applicationId: string, dto: ReviewApplicationDto): Promise<void> {
    try {
      const application = await this.findByIdOrFail(applicationId);

      // 1. 상태 검증
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Application already reviewed', {
          applicationId,
          currentStatus: application.status,
          reviewerId: dto.reviewerId,
        });
        throw CreatorApplicationException.applicationAlreadyReviewed();
      }

      // 2. 자기 신청 검토 방지
      if (application.userId === dto.reviewerId) {
        this.logger.warn('Reviewer cannot review own application', {
          applicationId,
          userId: application.userId,
          reviewerId: dto.reviewerId,
        });
        throw CreatorApplicationException.cannotReviewOwnApplication();
      }

      // 3. 메인 신청서 상태 업데이트
      application.status = dto.status;
      application.reviewedAt = new Date();
      application.reviewerId = dto.reviewerId;

      await this.applicationRepo.saveEntity(application);

      // 4. 검토 데이터를 정규화된 테이블에 저장
      await this.saveReviewData(applicationId, dto);

      // 5. 성공 로깅
      this.logger.log('Application reviewed successfully', {
        applicationId,
        userId: application.userId,
        reviewerId: dto.reviewerId,
        status: dto.status,
        hasReason: !!dto.reason,
      });

      // 6. 승인 시 Creator 엔티티 생성
      if (dto.status === ApplicationStatus.APPROVED) {
        await this.createCreatorFromApplication(applicationId);
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Application review failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId: dto.reviewerId,
        status: dto.status,
      });

      throw CreatorApplicationException.applicationReviewError();
    }
  }

  // ==================== 관리자 전용 메서드 ====================

  async searchApplicationsForAdmin(options: {
    status?: ApplicationStatus;
    page?: number;
    limit?: LimitType;
  }): Promise<PaginatedResult<ApplicationDetailDto>> {
    try {
      const { items, pageInfo } = await this.applicationRepo.searchApplications(options);

      const applicationDtos = items.map((application) =>
        plainToInstance(ApplicationDetailDto, application, {
          excludeExtraneousValues: true,
        })
      );

      this.logger.debug('Admin applications search completed', {
        totalFound: pageInfo.totalItems,
        page: options.page,
        status: options.status,
      });

      return { items: applicationDtos, pageInfo };
    } catch (error: unknown) {
      this.logger.error('Admin applications search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async getApplicationStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    try {
      const [pending, approved, rejected] = await Promise.all([
        this.applicationRepo.countByStatus(ApplicationStatus.PENDING),
        this.applicationRepo.countByStatus(ApplicationStatus.APPROVED),
        this.applicationRepo.countByStatus(ApplicationStatus.REJECTED),
      ]);

      return { pending, approved, rejected };
    } catch (error: unknown) {
      this.logger.error('Get application stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async saveNormalizedApplicationData(
    applicationId: string,
    dto: CreateApplicationDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    // 채널 정보 저장
    const channelInfo = this.channelInfoRepo.create({
      applicationId,
      platform: dto.channelInfo.platform,
      channelId: dto.channelInfo.channelId,
      channelUrl: dto.channelInfo.channelUrl,
      subscriberCount: dto.subscriberCount,
      contentCategory: dto.contentCategory,
      description: dto.description,
    });
    await this.channelInfoRepo.saveEntity(channelInfo, transactionManager);

    // 샘플 영상 저장
    if (dto.sampleVideos && dto.sampleVideos.length > 0) {
      const sampleVideos = dto.sampleVideos.map((video, index) =>
        this.sampleVideoRepo.create({
          applicationId,
          title: video.title,
          url: video.url,
          views: video.views,
          sortOrder: index + 1,
        })
      );
      for (const sampleVideo of sampleVideos) {
        await this.sampleVideoRepo.saveEntity(sampleVideo, transactionManager);
      }
    }
  }

  private async saveReviewData(applicationId: string, dto: ReviewApplicationDto, transactionManager?: EntityManager): Promise<void> {
    const reviewData = this.reviewRepo.create({
      applicationId,
    });

    // 조건부 할당 (exactOptionalPropertyTypes 준수)
    if (dto.reason !== undefined) {
      reviewData.reason = dto.reason;
    }
    if (dto.comment !== undefined) {
      reviewData.comment = dto.comment;
    }

    await this.reviewRepo.saveEntity(reviewData, transactionManager);
  }

  private async createCreatorFromApplication(applicationId: string): Promise<void> {
    try {
      // 정규화된 데이터 조회
      const channelInfo = await this.channelInfoRepo.findByApplicationId(applicationId);
      if (!channelInfo) {
        throw new Error('Channel info not found');
      }

      const application = await this.findByIdOrFail(applicationId);

      // Creator 생성을 위한 DTO 구성 (플랫폼 정보 제외)
      const createCreatorDto: CreateCreatorDto = {
        userId: application.userId,
        name: channelInfo.channelId,
        displayName: `${channelInfo.platform} Creator`,
        description: channelInfo.description,
        category: channelInfo.contentCategory,
        tags: [],
      };

      // Creator 엔티티 생성
      const creatorId = await this.creatorService.createCreator(createCreatorDto);

      // TODO: CreatorPlatformService를 통해 플랫폼 정보 별도 생성
      // const platformDto = {
      //   creatorId,
      //   type: channelInfo.platform as PlatformType,
      //   platformId: channelInfo.channelId,
      //   url: channelInfo.channelUrl,
      //   followerCount: channelInfo.subscriberCount,
      // };
      // await this.creatorPlatformService.createPlatform(platformDto);

      this.logger.log('Creator created successfully from approved application', {
        applicationId,
        userId: application.userId,
        creatorName: createCreatorDto.name,
        platform: channelInfo.platform,
        category: channelInfo.contentCategory,
        subscriberCount: channelInfo.subscriberCount,
      });
    } catch (error: unknown) {
      this.logger.error('Create creator from application failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });

      // Creator 생성 실패는 심각한 문제이므로 별도 알림 필요
      // 현재는 로깅만 하고 에러를 throw하지 않음 (승인 프로세스는 완료)
      // TODO: 관리자 알림 시스템 구현 시 알림 발송 추가
    }
  }
}
