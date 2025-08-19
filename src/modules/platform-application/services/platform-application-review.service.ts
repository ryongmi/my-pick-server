import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import {
  PlatformApplicationRepository,
  PlatformApplicationReviewRepository,
} from '../repositories/index.js';
import { PlatformApplicationEntity, PlatformApplicationReviewEntity } from '../entities/index.js';
import { ApplicationStatus, RejectionReason } from '../enums/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';

@Injectable()
export class PlatformApplicationReviewService {
  private readonly logger = new Logger(PlatformApplicationReviewService.name);

  constructor(
    private readonly reviewRepo: PlatformApplicationReviewRepository,
    private readonly platformApplyRepo: PlatformApplicationRepository
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

  // ==================== 검토 상태 업데이트 메서드 (Orchestration Service에서 사용) ====================

  async updateApplicationStatusForApproval(
    applicationId: string,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findApplicationByIdOrFail(applicationId);

      // 상태 업데이트
      application.status = ApplicationStatus.APPROVED;
      application.reviewerId = reviewerId;
      application.reviewedAt = new Date();

      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.save(application);

      this.logger.log('Platform application status updated to approved', {
        applicationId,
        reviewerId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application approval status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
    }
  }

  async updateApplicationStatusForRejection(
    applicationId: string,
    reviewerId: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const application = await this.findApplicationByIdOrFail(applicationId);

      // 상태 업데이트
      application.status = ApplicationStatus.REJECTED;
      application.reviewerId = reviewerId;
      application.reviewedAt = new Date();

      const manager = transactionManager || this.platformApplyRepo.manager;
      await manager.save(application);

      this.logger.log('Platform application status updated to rejected', {
        applicationId,
        reviewerId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform application rejection status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw PlatformApplicationException.applicationReviewError();
    }
  }

  // ==================== 검토 검증 메서드 (Orchestration Service에서 사용) ====================

  async validateReviewRequest(
    applicationId: string,
    reviewerId: string
  ): Promise<PlatformApplicationEntity> {
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

    return application;
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

}
