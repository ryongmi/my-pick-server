import { Injectable, Logger } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { LimitType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorApplicationRepository } from '../repositories/index.js';
import { ApplicationStatus } from '../enums/index.js';
import { ApplicationDetailDto } from '../dto/index.js';
import { CreatorApplicationException } from '../exceptions/index.js';

export interface ApplicationStatsDto {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvalRate: number;
  rejectionRate: number;
  avgProcessingDays: number;
}

export interface ApplicationTrendsDto {
  period: string;
  applications: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}

export interface ReviewerStatsDto {
  reviewerId: string;
  reviewerName?: string;
  totalReviews: number;
  approvals: number;
  rejections: number;
  avgProcessingDays: number;
  approvalRate: number;
}

@Injectable()
export class CreatorApplicationStatisticsService {
  private readonly logger = new Logger(CreatorApplicationStatisticsService.name);

  constructor(private readonly applicationRepo: CreatorApplicationRepository) {}

  // ==================== PUBLIC METHODS ====================

  async getApplicationStats(): Promise<ApplicationStatsDto> {
    try {
      const [pending, approved, rejected] = await Promise.all([
        this.applicationRepo.countByStatus(ApplicationStatus.PENDING),
        this.applicationRepo.countByStatus(ApplicationStatus.APPROVED),
        this.applicationRepo.countByStatus(ApplicationStatus.REJECTED),
      ]);

      const total = pending + approved + rejected;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;

      // 평균 처리 시간 계산
      const avgProcessingDays = await this.calculateAverageProcessingDays();

      return {
        pending,
        approved,
        rejected,
        total,
        approvalRate,
        rejectionRate,
        avgProcessingDays,
      };
    } catch (error: unknown) {
      this.logger.error('Get application stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async searchApplicationsForAdmin(options: {
    status?: ApplicationStatus;
    page?: number;
    limit?: LimitType;
    reviewerId?: string;
    fromDate?: Date;
    toDate?: Date;
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
        reviewerId: options.reviewerId,
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

  async getApplicationTrends(days = 30): Promise<ApplicationTrendsDto[]> {
    try {
      const trends = await this.applicationRepo.getApplicationTrendsByDays(days);

      this.logger.debug('Application trends calculated', {
        days,
        trendsCount: trends.length,
      });

      return trends.map(trend => ({
        period: trend.period,
        applications: trend.total,
        approved: trend.approved,
        rejected: trend.rejected,
        approvalRate: trend.total > 0 ? Math.round((trend.approved / trend.total) * 100) : 0,
      }));
    } catch (error: unknown) {
      this.logger.error('Get application trends failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async getReviewerStats(days = 30): Promise<ReviewerStatsDto[]> {
    try {
      const reviewerStats = await this.applicationRepo.getReviewerStats(days);

      this.logger.debug('Reviewer stats calculated', {
        days,
        reviewersCount: reviewerStats.length,
      });

      return reviewerStats.map(stat => ({
        reviewerId: stat.reviewerId,
        totalReviews: stat.totalReviews,
        approvals: stat.approvals,
        rejections: stat.rejections,
        avgProcessingDays: stat.avgProcessingDays,
        approvalRate: stat.totalReviews > 0 ? Math.round((stat.approvals / stat.totalReviews) * 100) : 0,
      }));
    } catch (error: unknown) {
      this.logger.error('Get reviewer stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        days,
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async getPendingApplicationsPriority(): Promise<ApplicationDetailDto[]> {
    try {
      const applications = await this.applicationRepo.findPendingByPriority();

      const applicationDtos = applications.map((application) =>
        plainToInstance(ApplicationDetailDto, application, {
          excludeExtraneousValues: true,
        })
      );

      this.logger.debug('Pending applications by priority fetched', {
        count: applications.length,
      });

      return applicationDtos;
    } catch (error: unknown) {
      this.logger.error('Get pending applications priority failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  async getApplicationsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ApplicationDetailDto[]> {
    try {
      const applications = await this.applicationRepo.findByDateRange(startDate, endDate);

      const applicationDtos = applications.map((application) =>
        plainToInstance(ApplicationDetailDto, application, {
          excludeExtraneousValues: true,
        })
      );

      this.logger.debug('Applications by date range fetched', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        count: applications.length,
      });

      return applicationDtos;
    } catch (error: unknown) {
      this.logger.error('Get applications by date range failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      throw CreatorApplicationException.applicationFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async calculateAverageProcessingDays(): Promise<number> {
    try {
      const processedApplications = await this.applicationRepo.findProcessedApplications();
      
      if (processedApplications.length === 0) {
        return 0;
      }

      const totalDays = processedApplications.reduce((sum, app) => {
        if (app.reviewedAt && app.appliedAt) {
          const diffMs = app.reviewedAt.getTime() - app.appliedAt.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }
        return sum;
      }, 0);

      return Math.round(totalDays / processedApplications.length);
    } catch (error: unknown) {
      this.logger.warn('Calculate average processing days failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}