import { Injectable, Logger, HttpException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { PlatformApplicationReviewRepository } from '../repositories/index.js';
import { PlatformApplicationReviewEntity } from '../entities/index.js';
import { RejectionReason } from '../enums/index.js';
import { PlatformApplicationException } from '../exceptions/index.js';

@Injectable()
export class PlatformApplicationReviewService {
  private readonly logger = new Logger(PlatformApplicationReviewService.name);

  constructor(private readonly reviewRepo: PlatformApplicationReviewRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByApplicationId(applicationId: string): Promise<PlatformApplicationReviewEntity | null> {
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
      const review = this.reviewRepo.create({
        applicationId,
        ...reviewData,
      });

      await this.reviewRepo.save(review);

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
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const updateResult = await this.reviewRepo.update(
        { applicationId },
        reviewData
      );

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

  // ==================== PRIVATE HELPER METHODS ====================
}