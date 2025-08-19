import { Injectable, Logger } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CreatorApplicationReviewRepository } from '../repositories/index.js';
import {
  CreatorApplicationReviewEntity,
  ReviewStatus,
  ReviewActionType,
} from '../entities/index.js';

export interface CreateReviewDto {
  applicationId: string;
  reviewerId: string;
  status: ReviewStatus;
  actionType: ReviewActionType;
  comment?: string;
  reason?: string;
  score?: number;
  estimatedDays?: number;
  isFinal?: boolean;
}

export interface UpdateReviewDto {
  status?: ReviewStatus;
  actionType?: ReviewActionType;
  comment?: string;
  reason?: string;
  score?: number;
  estimatedDays?: number;
  isFinal?: boolean;
}

export interface ReviewSummary {
  applicationId: string;
  totalReviews: number;
  currentStatus: ReviewStatus;
  lastReviewDate: Date;
  averageScore?: number;
  isCompleted: boolean;
  reviewHistory: CreatorApplicationReviewEntity[];
}

@Injectable()
export class CreatorApplicationReviewService {
  private readonly logger = new Logger(CreatorApplicationReviewService.name);

  constructor(private readonly reviewRepo: CreatorApplicationReviewRepository) {}

  // ==================== PUBLIC METHODS ====================

  async findByApplicationId(applicationId: string): Promise<CreatorApplicationReviewEntity | null> {
    return this.reviewRepo.findByApplicationId(applicationId);
  }

  async createReview(
    dto: CreateReviewDto,
    transactionManager?: EntityManager
  ): Promise<CreatorApplicationReviewEntity> {
    try {
      const review = this.reviewRepo.create(dto);
      const savedReview = await this.reviewRepo.saveEntity(review, transactionManager);

      this.logger.log('Review created successfully', {
        reviewId: savedReview.id,
        applicationId: dto.applicationId,
        status: dto.status,
        actionType: dto.actionType,
        reviewerId: dto.reviewerId,
      });

      return savedReview;
    } catch (error: unknown) {
      this.logger.error('Failed to create review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId: dto.applicationId,
        reviewerId: dto.reviewerId,
      });
      throw error;
    }
  }

  async updateReview(reviewId: string, dto: UpdateReviewDto): Promise<void> {
    try {
      await this.reviewRepo.update(reviewId, dto);

      this.logger.log('Review updated successfully', {
        reviewId,
        status: dto.status,
        actionType: dto.actionType,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
        updateData: dto,
      });
      throw error;
    }
  }

  async approveApplication(
    applicationId: string,
    reviewerId: string,
    comment?: string
  ): Promise<CreatorApplicationReviewEntity> {
    try {
      const reviewDto: {
        applicationId: string;
        reviewerId: string;
        status: ReviewStatus;
        actionType: ReviewActionType;
        isFinal: boolean;
        score: number;
        comment?: string;
      } = {
        applicationId,
        reviewerId,
        status: ReviewStatus.APPROVED,
        actionType: ReviewActionType.STATUS_CHANGE,
        isFinal: true,
        score: 100, // 승인은 만점
      };

      if (comment) {
        reviewDto.comment = comment;
      }

      const review = await this.createReview(reviewDto);

      this.logger.log('Application approved', {
        applicationId,
        reviewerId,
        reviewId: review.id,
      });

      return review;
    } catch (error: unknown) {
      this.logger.error('Failed to approve application', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw error;
    }
  }

  async rejectApplication(
    applicationId: string,
    reviewerId: string,
    reason: string,
    comment?: string
  ): Promise<CreatorApplicationReviewEntity> {
    try {
      const reviewDto: {
        applicationId: string;
        reviewerId: string;
        status: ReviewStatus;
        actionType: ReviewActionType;
        reason: string;
        isFinal: boolean;
        score: number;
        comment?: string;
      } = {
        applicationId,
        reviewerId,
        status: ReviewStatus.REJECTED,
        actionType: ReviewActionType.STATUS_CHANGE,
        reason,
        isFinal: true,
        score: 0, // 거부는 0점
      };

      if (comment) {
        reviewDto.comment = comment;
      }

      const review = await this.createReview(reviewDto);

      this.logger.log('Application rejected', {
        applicationId,
        reviewerId,
        reviewId: review.id,
        reason,
      });

      return review;
    } catch (error: unknown) {
      this.logger.error('Failed to reject application', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
        reason,
      });
      throw error;
    }
  }

  async requestRevision(
    applicationId: string,
    reviewerId: string,
    reason: string,
    estimatedDays?: number
  ): Promise<CreatorApplicationReviewEntity> {
    try {
      const reviewDto: {
        applicationId: string;
        reviewerId: string;
        status: ReviewStatus;
        actionType: ReviewActionType;
        reason: string;
        isFinal: boolean;
        estimatedDays?: number;
      } = {
        applicationId,
        reviewerId,
        status: ReviewStatus.REVISION_REQUIRED,
        actionType: ReviewActionType.STATUS_CHANGE,
        reason,
        isFinal: false,
      };

      if (estimatedDays !== undefined) {
        reviewDto.estimatedDays = estimatedDays;
      }

      const review = await this.createReview(reviewDto);

      this.logger.log('Revision requested', {
        applicationId,
        reviewerId,
        reviewId: review.id,
        estimatedDays,
      });

      return review;
    } catch (error: unknown) {
      this.logger.error('Failed to request revision', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
        reason,
      });
      throw error;
    }
  }

  async addComment(
    applicationId: string,
    reviewerId: string,
    comment: string
  ): Promise<CreatorApplicationReviewEntity> {
    try {
      const reviewDto: CreateReviewDto = {
        applicationId,
        reviewerId,
        status: ReviewStatus.IN_REVIEW,
        actionType: ReviewActionType.COMMENT_ADDED,
        comment,
        isFinal: false,
      };

      const review = await this.createReview(reviewDto);

      this.logger.log('Comment added to review', {
        applicationId,
        reviewerId,
        reviewId: review.id,
      });

      return review;
    } catch (error: unknown) {
      this.logger.error('Failed to add comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        reviewerId,
      });
      throw error;
    }
  }

  async getReviewSummary(applicationId: string): Promise<ReviewSummary | null> {
    try {
      const reviews = await this.getReviewHistory(applicationId);
      if (reviews.length === 0) return null;

      const latestReview = reviews[0]; // 최신 리뷰 (createdAt DESC 정렬)
      if (!latestReview) return null; // 추가 안전 검사

      const scores = reviews.filter((r) => r.score !== null).map((r) => r.score!);
      const averageScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined;

      const summary: ReviewSummary = {
        applicationId,
        totalReviews: reviews.length,
        currentStatus: latestReview.status,
        lastReviewDate: latestReview.createdAt,
        isCompleted:
          latestReview.isFinal &&
          (latestReview.status === ReviewStatus.APPROVED ||
            latestReview.status === ReviewStatus.REJECTED),
        reviewHistory: reviews,
      };

      if (averageScore !== undefined) {
        summary.averageScore = averageScore;
      }

      return summary;
    } catch (error: unknown) {
      this.logger.error('Failed to get review summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw error;
    }
  }

  async getReviewHistory(applicationId: string): Promise<CreatorApplicationReviewEntity[]> {
    try {
      return this.reviewRepo.find({
        where: { applicationId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get review history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
      });
      throw error;
    }
  }

  async getReviewsByReviewer(reviewerId: string): Promise<CreatorApplicationReviewEntity[]> {
    try {
      return this.reviewRepo.find({
        where: { reviewerId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Failed to get reviews by reviewer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewerId,
      });
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private calculateEstimatedDays(status: ReviewStatus): number {
    switch (status) {
      case ReviewStatus.PENDING:
        return 3;
      case ReviewStatus.IN_REVIEW:
        return 5;
      case ReviewStatus.REVISION_REQUIRED:
        return 7;
      default:
        return 1;
    }
  }

  private isReviewCompleted(status: ReviewStatus): boolean {
    return status === ReviewStatus.APPROVED || status === ReviewStatus.REJECTED;
  }
}
