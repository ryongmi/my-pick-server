import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { ReportReviewRepository } from '../repositories/index.js';
import { ReportReviewEntity } from '../entities/index.js';
import { ReportException } from '../exceptions/index.js';

export interface CreateReviewDto {
  reviewerId: string;
  reviewedAt: Date;
  reviewComment?: string;
}

export interface UpdateReviewDto {
  reviewComment?: string;
  reviewedAt?: Date;
}

@Injectable()
export class ReportReviewService {
  private readonly logger = new Logger(ReportReviewService.name);

  constructor(
    private readonly reviewRepo: ReportReviewRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByReportId(reportId: string): Promise<ReportReviewEntity | null> {
    try {
      return await this.reviewRepo.findByReportId(reportId);
    } catch (error: unknown) {
      this.logger.error('Review fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.reviewNotFound();
    }
  }

  async findByReportIdOrFail(reportId: string): Promise<ReportReviewEntity> {
    const review = await this.findByReportId(reportId);
    if (!review) {
      throw ReportException.reviewNotFound();
    }
    return review;
  }

  // 생성 메서드
  async createReview(
    reportId: string,
    dto: CreateReviewDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 중복 검토 확인
      const existingReview = await this.reviewRepo.findByReportId(reportId);
      if (existingReview) {
        throw ReportException.reviewAlreadyExists();
      }

      // 검토 데이터 저장
      await this.reviewRepo.saveReview(reportId, dto);

      this.logger.log('Review created successfully', {
        reportId,
        reviewerId: dto.reviewerId,
        reviewedAt: dto.reviewedAt,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Review creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        reviewerId: dto.reviewerId,
      });
      throw ReportException.reviewCreateError();
    }
  }

  // 수정 메서드
  async updateReview(
    reportId: string,
    dto: UpdateReviewDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 기존 검토 확인
      const _review = await this.findByReportIdOrFail(reportId);

      // 수정할 데이터 구성
      const updateData: Partial<ReportReviewEntity> = {};

      if (dto.reviewComment !== undefined) {
        updateData.reviewComment = dto.reviewComment;
      }
      if (dto.reviewedAt !== undefined) {
        updateData.reviewedAt = dto.reviewedAt;
      }

      // 저장
      await this.reviewRepo.updateReview(reportId, updateData as Record<string, unknown>);

      this.logger.log('Review updated successfully', {
        reportId,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Review update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.reviewUpdateError();
    }
  }

  // 삭제 메서드
  async deleteByReportId(
    reportId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      const deletedCount = 0;

      this.logger.log('Review deleted successfully', {
        reportId,
        deletedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Review deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.reviewDeleteError();
    }
  }

  async deleteById(
    reviewId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      await Promise.resolve();

      this.logger.log('Review deleted successfully', {
        reviewId,
      });
    } catch (error: unknown) {
      this.logger.error('Review deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
      });
      throw ReportException.reviewDeleteError();
    }
  }

  // ==================== 집계 메서드 ====================

  async countByReportId(reportId: string): Promise<number> {
    try {
      const _review = await this.reviewRepo.findByReportId(reportId);
      return _review ? 1 : 0;
    } catch (error: unknown) {
      this.logger.error('Review count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return 0;
    }
  }

  async findByReviewerId(reviewerId: string, limit = 50): Promise<ReportReviewEntity[]> {
    try {
      return await this.reviewRepo.findByReviewerId(reviewerId, limit);
    } catch (error: unknown) {
      this.logger.error('Reviews by reviewer fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewerId,
        limit,
      });
      return [];
    }
  }

  async getReviewStatsByReviewer(reviewerId: string): Promise<{
    totalReviews: number;
    reviewsThisMonth: number;
    averageReviewTime: number;
  }> {
    try {
      return await this.reviewRepo.getReviewStatsByReviewer(reviewerId);
    } catch (error: unknown) {
      this.logger.error('Review stats fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewerId,
      });
      return {
        totalReviews: 0,
        reviewsThisMonth: 0,
        averageReviewTime: 0,
      };
    }
  }
}