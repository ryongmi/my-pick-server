import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
} from '../repositories/index.js';
import { CreatorApplicationEntity } from '../entities/index.js';
import { ApplicationStatus } from '../enums/index.js';
import { CreateApplicationDto, ReviewApplicationDto } from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { CreatorOrchestrationService } from '../../creator/services/creator-orchestration.service.js';
import { CreateCreatorDto } from '../../creator/dto/index.js';
import { ConsentType } from '../../creator/entities/index.js';

@Injectable()
export class CreatorApplicationOrchestrationService {
  private readonly logger = new Logger(CreatorApplicationOrchestrationService.name);

  constructor(
    private readonly applicationRepo: CreatorApplicationRepository,
    private readonly channelInfoRepo: CreatorApplicationChannelInfoRepository,
    private readonly sampleVideoRepo: CreatorApplicationSampleVideoRepository,
    private readonly reviewRepo: CreatorApplicationReviewRepository,
    private readonly creatorService: CreatorService,
    private readonly creatorOrchestrationService: CreatorOrchestrationService
  ) {}

  // ==================== 신청 오케스트레이션 ====================

  async createApplicationComplete(
    dto: CreateApplicationDto,
    transactionManager?: EntityManager
  ): Promise<string> {
    try {
      // 1. 활성 신청 존재 확인
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

      // 2. 메인 신청서 엔티티 생성
      const application = new CreatorApplicationEntity();
      Object.assign(application, {
        userId: dto.userId,
        status: ApplicationStatus.PENDING,
        applicantMessage: dto.applicantMessage,
        priority: dto.priority || 0,
      });

      const savedApplication = await this.applicationRepo.saveEntity(application, transactionManager);

      // 3. 정규화된 데이터 저장
      await this.saveNormalizedApplicationData(savedApplication.id, dto, transactionManager);

      this.logger.log('Creator application created successfully', {
        applicationId: savedApplication.id,
        userId: dto.userId,
        platform: dto.channelInfo.platform,
        subscriberCount: dto.subscriberCount,
        category: dto.contentCategory,
      });

      return savedApplication.id;
    } catch (error: unknown) {
      this.handleOrchestrationError(
        error,
        'Application creation',
        { userId: dto.userId, platform: dto.channelInfo.platform },
        CreatorApplicationException.applicationCreateError
      );
    }
  }

  // ==================== 검토 오케스트레이션 ====================

  async reviewApplicationComplete(
    applicationId: string,
    dto: ReviewApplicationDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.applicationRepo.findOneById(applicationId);
      if (!application) {
        throw CreatorApplicationException.applicationNotFound();
      }

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

      await this.applicationRepo.saveEntity(application, transactionManager);

      // 4. 검토 데이터를 정규화된 테이블에 저장
      await this.saveReviewData(applicationId, dto, transactionManager);

      this.logger.log('Application reviewed successfully', {
        applicationId,
        userId: application.userId,
        reviewerId: dto.reviewerId,
        status: dto.status,
        hasReason: !!dto.reason,
      });

      // 5. 승인 시 Creator 엔티티 생성
      if (dto.status === ApplicationStatus.APPROVED) {
        await this.createCreatorFromApplication(applicationId, transactionManager);
      }
    } catch (error: unknown) {
      this.handleOrchestrationError(
        error,
        'Application review',
        { applicationId, reviewerId: dto.reviewerId, status: dto.status },
        CreatorApplicationException.applicationReviewError
      );
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

  private async saveReviewData(
    applicationId: string,
    dto: ReviewApplicationDto,
    transactionManager?: EntityManager
  ): Promise<void> {
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

  private async createCreatorFromApplication(
    applicationId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 정규화된 데이터 조회
      const channelInfo = await this.channelInfoRepo.findByApplicationId(applicationId);
      if (!channelInfo) {
        throw new Error('Channel info not found');
      }

      const application = await this.applicationRepo.findOneById(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      // Creator 생성을 위한 DTO 구성
      const createCreatorDto: CreateCreatorDto = {
        userId: application.userId,
        name: channelInfo.channelId,
        displayName: `${channelInfo.platform} Creator`,
        description: channelInfo.description,
        category: channelInfo.contentCategory,
        tags: [],
      };

      // 플랫폼 정보
      const platforms = [{
        type: channelInfo.platform as PlatformType,
        platformId: channelInfo.channelId,
        url: channelInfo.channelUrl,
        displayName: `${channelInfo.platform} Channel`,
      }];

      // 기본 동의 (데이터 수집)
      const consents = [ConsentType.DATA_COLLECTION];

      // CreatorOrchestrationService를 통한 완전한 생성
      const creatorId = await this.creatorOrchestrationService.createCreatorWithPlatforms(
        createCreatorDto,
        platforms,
        consents,
        transactionManager
      );

      this.logger.log('Creator created successfully from approved application', {
        applicationId,
        creatorId,
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

      // Creator 생성 실패는 심각한 문제이므로 에러 전파
      throw new Error(`Creator creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleOrchestrationError(
    error: unknown,
    operation: string,
    context: Record<string, unknown>,
    fallbackException: () => HttpException
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    throw fallbackException();
  }
}