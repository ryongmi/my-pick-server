import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

// import { CreatorApplicationEntity } from '../entities/index.js';
import { ApplicationStatus, ReviewStatus, ReviewActionType } from '../enums/index.js';
import { CreateApplicationDto, ReviewApplicationDto } from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/index.js';
import { CreatorOrchestrationService } from '../../creator/services/creator-orchestration.service.js';
import { CreateCreatorDto } from '../../creator/dto/index.js';
import { ConsentType } from '../../creator/entities/index.js';

import { CreatorApplicationService } from './creator-application.service.js';
import { CreatorApplicationChannelInfoService } from './creator-application-channel-info.service.js';
import { CreatorApplicationSampleVideoService } from './creator-application-sample-video.service.js';
import { CreatorApplicationReviewService } from './creator-application-review.service.js';

@Injectable()
export class CreatorApplicationOrchestrationService {
  private readonly logger = new Logger(CreatorApplicationOrchestrationService.name);

  constructor(
    private readonly creatorApplicationService: CreatorApplicationService,
    private readonly channelInfoService: CreatorApplicationChannelInfoService,
    private readonly sampleVideoService: CreatorApplicationSampleVideoService,
    private readonly reviewService: CreatorApplicationReviewService,
    private readonly creatorService: CreatorService,
    private readonly creatorOrchestrationService: CreatorOrchestrationService
  ) {}

  // ==================== 신청 오케스트레이션 ====================

  async createApplicationComplete(
    dto: CreateApplicationDto,
    transactionManager?: EntityManager
  ): Promise<string> {
    try {
      // 1. 메인 신청서 생성 (중복 확인 포함)
      const applicationId = await this.creatorApplicationService.createApplication(
        dto,
        transactionManager
      );

      // 2. 채널 정보 저장
      await this.channelInfoService.createChannelInfo(
        applicationId,
        {
          platform: dto.channelInfo.platform,
          channelId: dto.channelInfo.channelId,
          channelUrl: dto.channelInfo.channelUrl,
          subscriberCount: dto.subscriberCount,
          contentCategory: dto.contentCategory,
          description: dto.description,
        },
        transactionManager
      );

      // 3. 샘플 영상 저장
      if (dto.sampleVideos && dto.sampleVideos.length > 0) {
        await this.sampleVideoService.createSampleVideos(
          applicationId,
          dto.sampleVideos,
          transactionManager
        );
      }

      this.logger.log('Creator application created successfully', {
        applicationId,
        userId: dto.userId,
        platform: dto.channelInfo.platform,
        subscriberCount: dto.subscriberCount,
        category: dto.contentCategory,
        sampleVideoCount: dto.sampleVideos?.length || 0,
      });

      return applicationId;
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
      // 1. 신청서 상태 업데이트 (검증 로직 포함)
      await this.creatorApplicationService.updateApplicationStatus(
        applicationId,
        dto.status,
        dto.reviewerId,
        transactionManager
      );

      // 2. 검토 데이터 저장
      if (dto.reason || dto.comment) {
        const reviewDto = {
          applicationId,
          reviewerId: dto.reviewerId,
          status: dto.status === ApplicationStatus.APPROVED ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
          actionType: dto.status === ApplicationStatus.APPROVED ? ReviewActionType.STATUS_CHANGE : ReviewActionType.STATUS_CHANGE,
          isFinal: true,
          ...(dto.reason && { reason: dto.reason }),
          ...(dto.comment && { comment: dto.comment }),
        };

        await this.reviewService.createReview(reviewDto, transactionManager);
      }

      // 3. 신청서 정보 조회 (로깅용)
      const application = await this.creatorApplicationService.findByIdOrFail(applicationId);

      this.logger.log('Application reviewed successfully', {
        applicationId,
        userId: application.userId,
        reviewerId: dto.reviewerId,
        status: dto.status,
        hasReason: !!dto.reason,
        hasComment: !!dto.comment,
      });

      // 4. 승인 시 Creator 엔티티 생성
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

  private async createCreatorFromApplication(
    applicationId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 서비스 레이어를 통한 데이터 조회
      const channelInfo = await this.channelInfoService.findByApplicationId(applicationId);
      if (!channelInfo) {
        throw new Error('Channel info not found');
      }

      const application = await this.creatorApplicationService.findByIdOrFail(applicationId);

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
      const platforms = [
        {
          type: channelInfo.platform as PlatformType,
          platformId: channelInfo.channelId,
          url: channelInfo.channelUrl,
          displayName: `${channelInfo.platform} Channel`,
        },
      ];

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
      throw new Error(
        `Creator creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
