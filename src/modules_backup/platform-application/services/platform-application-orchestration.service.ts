import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, DataSource } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import { PlatformApplicationEntity } from '../entities/index.js';
import { ApplicationStatus } from '../enums/index.js';
import {
  CreatePlatformApplicationDto,
  ApproveApplicationDto,
  RejectApplicationDto,
} from '../dto/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { CreatePlatformInternalDto } from '../../creator/dto/create-platform-internal.dto.js';

import {
  PlatformApplicationService,
  PlatformApplicationDataService,
  PlatformApplicationReviewService,
} from './index.js';

@Injectable()
export class PlatformApplicationOrchestrationService {
  private readonly logger = new Logger(PlatformApplicationOrchestrationService.name);

  constructor(
    private readonly platformApplicationService: PlatformApplicationService,
    private readonly platformAppDataService: PlatformApplicationDataService,
    private readonly platformAppReviewService: PlatformApplicationReviewService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly dataSource: DataSource
  ) {}

  // ==================== 신청 오케스트레이션 ====================

  async createApplicationComplete(
    dto: CreatePlatformApplicationDto,
    userId: string,
    transactionManager?: EntityManager
  ): Promise<string> {
    try {
      // 1. 크리에이터 존재 확인
      await this.creatorService.findByIdOrFail(dto.creatorId);

      // 2. PlatformApplicationService를 통한 신청 생성 (중복 확인 포함)
      const applicationId = await this.platformApplicationService.createApplication(
        dto,
        userId,
        transactionManager
      );

      this.logger.log('Platform application created successfully', {
        applicationId,
        creatorId: dto.creatorId,
        platformType: dto.platformData.type,
        userId,
      });

      return applicationId;
    } catch (error: unknown) {
      this.handleOrchestrationError(
        error,
        'Platform application creation',
        { creatorId: dto.creatorId, platformType: dto.platformData.type, userId },
        PlatformApplicationException.applicationCreateError
      );
    }
  }

  // ==================== 검토 오케스트레이션 ====================

  async approveApplicationComplete(
    applicationId: string,
    dto: ApproveApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.platformApplicationService.findByIdOrFail(applicationId);

      // 1. 상태 검증
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Platform application already reviewed', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.applicationAlreadyReviewed();
      }

      // 2. 자기 신청 검토 방지
      if (application.userId === reviewerId) {
        this.logger.warn('Cannot review own platform application', {
          applicationId,
          userId: application.userId,
          reviewerId,
        });
        throw PlatformApplicationException.cannotReviewOwnApplication();
      }

      // 3. 신청 승인 처리
      await this.platformApplicationService.updateApplicationStatus(
        applicationId,
        ApplicationStatus.APPROVED,
        reviewerId,
        transactionManager
      );

      // 4. 검토 데이터 저장
      const reviewData: {
        comment?: string;
      } = {};
      if (dto.comment !== undefined) {
        reviewData.comment = dto.comment;
      }

      await this.platformAppReviewService.createReviewData(applicationId, reviewData, transactionManager);

      // 5. 실제 플랫폼 생성 (트랜잭션 필수)
      if (transactionManager) {
        await this.createPlatformFromApplication(application, transactionManager);
      } else {
        // 트랜잭션이 없는 경우 새 트랜잭션 생성
        await this.dataSource.transaction(async (txManager) => {
          await this.createPlatformFromApplication(application, txManager);
        });
      }

      // 플랫폼 데이터 조회해서 로깅
      const platformData = await this.platformAppDataService.findByApplicationId(applicationId);

      this.logger.log('Platform application approved successfully', {
        applicationId,
        creatorId: application.creatorId,
        platformType: platformData?.type,
        reviewerId,
      });
    } catch (error: unknown) {
      this.handleOrchestrationError(
        error,
        'Platform application approval',
        { applicationId, reviewerId },
        PlatformApplicationException.applicationReviewError
      );
    }
  }

  async rejectApplicationComplete(
    applicationId: string,
    dto: RejectApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.platformApplicationService.findByIdOrFail(applicationId);

      // 1. 상태 검증
      if (application.status !== ApplicationStatus.PENDING) {
        this.logger.warn('Platform application already reviewed', {
          applicationId,
          status: application.status,
        });
        throw PlatformApplicationException.applicationAlreadyReviewed();
      }

      // 2. 자기 신청 검토 방지
      if (application.userId === reviewerId) {
        this.logger.warn('Cannot review own platform application', {
          applicationId,
          userId: application.userId,
          reviewerId,
        });
        throw PlatformApplicationException.cannotReviewOwnApplication();
      }

      // 3. 신청 거부 처리
      await this.platformApplicationService.updateApplicationStatus(
        applicationId,
        ApplicationStatus.REJECTED,
        reviewerId,
        transactionManager
      );

      // 4. 검토 데이터 저장
      const rejectReviewData: {
        reasons: typeof dto.reasons;
        customReason?: string;
        comment?: string;
        requirements?: string[];
      } = {
        reasons: dto.reasons,
      };

      if (dto.customReason !== undefined) {
        rejectReviewData.customReason = dto.customReason;
      }
      if (dto.comment !== undefined) {
        rejectReviewData.comment = dto.comment;
      }
      if (dto.requirements !== undefined) {
        rejectReviewData.requirements = dto.requirements;
      }

      await this.platformAppReviewService.createReviewData(applicationId, rejectReviewData, transactionManager);

      this.logger.log('Platform application rejected successfully', {
        applicationId,
        reasons: dto.reasons,
        customReason: dto.customReason,
        reviewerId,
      });
    } catch (error: unknown) {
      this.handleOrchestrationError(
        error,
        'Platform application rejection',
        { applicationId, reviewerId },
        PlatformApplicationException.applicationReviewError
      );
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async createPlatformFromApplication(
    application: PlatformApplicationEntity,
    transactionManager: EntityManager
  ): Promise<void> {
    try {
      // 분리된 엔티티에서 플랫폼 데이터 조회
      const platformData = await this.platformAppDataService.findByApplicationId(application.id);

      // 플랫폼 데이터 검증
      if (!platformData || !platformData.type || !platformData.platformId || !platformData.url) {
        throw PlatformApplicationException.invalidPlatformData();
      }

      // CreatorPlatformService를 통해 플랫폼 생성
      const createPlatformData: CreatePlatformInternalDto = {
        creatorId: application.creatorId,
        type: platformData.type as PlatformType,
        platformId: platformData.platformId,
        url: platformData.url,
      };

      if (platformData.displayName !== undefined) {
        createPlatformData.displayName = platformData.displayName;
      }

      await this.creatorPlatformService.createPlatform(createPlatformData, transactionManager);

      this.logger.log('Platform created from approved application', {
        applicationId: application.id,
        creatorId: application.creatorId,
        platformType: platformData.type,
        platformId: platformData.platformId,
      });
    } catch (error: unknown) {
      this.logger.error('Platform creation from application failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId: application.id,
      });
      throw PlatformApplicationException.platformCreationError();
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