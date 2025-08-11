import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { PlatformType } from '@common/enums/index.js';

import {
  PlatformApplicationRepository,
  PlatformApplicationReviewRepository,
} from '../repositories/index.js';
import { PlatformApplicationEntity, PlatformApplicationReviewEntity } from '../entities/index.js';
import { ApplicationStatus, RejectionReason } from '../enums/index.js';
import {
  ApproveApplicationDto,
  RejectApplicationDto,
} from '../dto/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';
import { CreatorService } from '../../creator/services/creator.service.js';
import { CreatorPlatformService } from '../../creator/services/creator-platform.service.js';
import { CreatePlatformInternalDto } from '../../creator/dto/create-platform-internal.dto.js';

import { PlatformApplicationDataService } from './platform-application-data.service.js';

@Injectable()
export class PlatformApplicationReviewService {
  private readonly logger = new Logger(PlatformApplicationReviewService.name);

  constructor(
    private readonly reviewRepo: PlatformApplicationReviewRepository,
    private readonly platformApplyRepo: PlatformApplicationRepository,
    private readonly platformAppDataService: PlatformApplicationDataService,
    private readonly creatorService: CreatorService,
    private readonly creatorPlatformService: CreatorPlatformService
  ) {}

  // ==================== 에러 처리 헬퍼 메서드 ====================

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      throw PlatformApplicationException.applicationReviewError();
    }
  }

  // ==================== PUBLIC METHODS ====================

  async findByApplicationId(
    applicationId: string
  ): Promise<PlatformApplicationReviewEntity | null> {
    try {
      return await this.reviewRepo.findByApplicationId(applicationId);
    } catch (error: unknown) {
      this.logger.error('Platform application review fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw PlatformApplicationException.applicationFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createReviewData(
    applicationId: string,
    reviewData: {
      reasons?: RejectionReason[];
      customReason?: string;
      comment?: string;
      requirements?: string[];
      reason?: string;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const reviewObj: Partial<PlatformApplicationReviewEntity> = {
        applicationId,
      };

      if (reviewData.reasons !== undefined) {
        reviewObj.reasons = reviewData.reasons;
      }
      if (reviewData.customReason !== undefined) {
        reviewObj.customReason = reviewData.customReason;
      }
      if (reviewData.comment !== undefined) {
        reviewObj.comment = reviewData.comment;
      }
      if (reviewData.requirements !== undefined) {
        reviewObj.requirements = reviewData.requirements;
      }
      if (reviewData.reason !== undefined) {
        reviewObj.reason = reviewData.reason;
      }

      const review = this.reviewRepo.create(reviewObj) as unknown as PlatformApplicationReviewEntity;
      await this.reviewRepo.saveEntity(review, transactionManager);

      this.logger.log('Platform application review created', {
        applicationId,
        hasReasons: !!reviewData.reasons?.length,
        hasComment: !!reviewData.comment,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application review creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });

      throw PlatformApplicationException.applicationUpdateError();
    }
  }

  async updateReviewData(
    applicationId: string,
    reviewData: Partial<{
      reasons: RejectionReason[];
      customReason: string;
      comment: string;
      requirements: string[];
      reason: string;
    }>,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const updateObj: Partial<PlatformApplicationReviewEntity> = {};

      if (reviewData.reasons !== undefined) {
        updateObj.reasons = reviewData.reasons;
      }
      if (reviewData.customReason !== undefined) {
        updateObj.customReason = reviewData.customReason;
      }
      if (reviewData.comment !== undefined) {
        updateObj.comment = reviewData.comment;
      }
      if (reviewData.requirements !== undefined) {
        updateObj.requirements = reviewData.requirements;
      }
      if (reviewData.reason !== undefined) {
        updateObj.reason = reviewData.reason;
      }

      const updateResult = await this.reviewRepo.update({ applicationId }, updateObj);

      if (updateResult.affected === 0) {
        throw PlatformApplicationException.applicationNotFound();
      }

      this.logger.log('Platform application review updated', {
        applicationId,
        updatedFields: Object.keys(reviewData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application review update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });

      throw PlatformApplicationException.applicationUpdateError();
    }
  }

  // ==================== 검토 및 승인/거부 메서드 ====================

  async approveApplication(
    applicationId: string,
    dto: ApproveApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findApplicationByIdOrFail(applicationId);

      // 1. 상태 확인
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

      const manager = transactionManager || this.platformApplyRepo.manager;

      await manager.transaction(async (txManager) => {
        // 3. 신청 승인 처리
        application.status = ApplicationStatus.APPROVED;
        application.reviewerId = reviewerId;
        application.reviewedAt = new Date();

        await txManager.save(application);

        // 4. 리뷰 데이터 저장
        const reviewData: {
          reasons?: RejectionReason[];
          customReason?: string;
          comment?: string;
          requirements?: string[];
          reason?: string;
        } = {};
        if (dto.comment !== undefined) {
          reviewData.comment = dto.comment;
        }

        await this.createReviewData(applicationId, reviewData, txManager);

        // 5. 실제 플랫폼 생성
        await this.createPlatformFromApplication(application, txManager);

        // 6. 플랫폼 데이터 조회해서 로깅
        const platformData = await this.platformAppDataService.findByApplicationId(applicationId);

        this.logger.log('Platform application approved successfully', {
          applicationId,
          creatorId: application.creatorId,
          platformType: platformData?.type,
          reviewerId,
        });
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
    }
  }

  async rejectApplication(
    applicationId: string,
    dto: RejectApplicationDto,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findApplicationByIdOrFail(applicationId);

      // 1. 상태 확인
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
      application.status = ApplicationStatus.REJECTED;
      application.reviewerId = reviewerId;
      application.reviewedAt = new Date();

      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.transaction(async (txManager) => {
        // 메인 신청 엔티티 업데이트
        await txManager.save(application);

        // 리뷰 데이터 저장
        const rejectReviewData: {
          reasons?: RejectionReason[];
          customReason?: string;
          comment?: string;
          requirements?: string[];
          reason?: string;
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

        await this.createReviewData(
          applicationId,
          rejectReviewData,
          txManager
        );
      });

      this.logger.log('Platform application rejected successfully', {
        applicationId,
        reasons: dto.reasons,
        customReason: dto.customReason,
        reviewerId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application rejection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
    }
  }

  async batchReviewApplications(
    applicationIds: string[],
    action: 'approve' | 'reject',
    reviewData: ApproveApplicationDto | RejectApplicationDto,
    reviewerId: string
  ): Promise<{
    processed: number;
    failed: number;
    results: Array<{ applicationId: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ applicationId: string; success: boolean; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const applicationId of applicationIds) {
      try {
        if (action === 'approve') {
          await this.approveApplication(applicationId, reviewData as ApproveApplicationDto, reviewerId);
        } else {
          await this.rejectApplication(applicationId, reviewData as RejectApplicationDto, reviewerId);
        }
        
        results.push({ applicationId, success: true });
        processed++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ applicationId, success: false, error: errorMessage });
        failed++;
        
        this.logger.warn('Batch review failed for application', {
          applicationId,
          action,
          error: errorMessage,
        });
      }
    }

    this.logger.log('Batch review completed', {
      action,
      totalApplications: applicationIds.length,
      processed,
      failed,
      reviewerId,
    });

    return { processed, failed, results };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async findApplicationByIdOrFail(applicationId: string): Promise<PlatformApplicationEntity> {
    const application = await this.platformApplyRepo.findOne({
      where: { id: applicationId },
    });
    
    if (!application) {
      this.logger.warn('Platform application not found', { applicationId });
      throw PlatformApplicationException.applicationNotFound();
    }
    
    return application;
  }

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
}
