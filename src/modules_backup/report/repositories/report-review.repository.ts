import { Injectable } from '@nestjs/common';

import { DataSource, Repository, MoreThanOrEqual } from 'typeorm';

import { ReportReviewEntity } from '../entities/index.js';

@Injectable()
export class ReportReviewRepository extends Repository<ReportReviewEntity> {
  constructor(private dataSource: DataSource) {
    super(ReportReviewEntity, dataSource.createEntityManager());
  }

  async findByReportId(reportId: string): Promise<ReportReviewEntity | null> {
    return this.findOne({ where: { reportId } });
  }

  async saveReview(
    reportId: string,
    reviewData: {
      reviewerId?: string;
      reviewedAt?: Date;
      reviewComment?: string;
    }
  ): Promise<void> {
    const review = new ReportReviewEntity();
    review.reportId = reportId;

    if (reviewData.reviewerId !== undefined) {
      review.reviewerId = reviewData.reviewerId;
    }
    if (reviewData.reviewedAt !== undefined) {
      review.reviewedAt = reviewData.reviewedAt;
    }
    if (reviewData.reviewComment !== undefined) {
      review.reviewComment = reviewData.reviewComment;
    }

    await this.save(review);
  }

  async updateReview(
    reportId: string,
    reviewData: Partial<{
      reviewerId: string;
      reviewedAt: Date;
      reviewComment: string;
    }>
  ): Promise<void> {
    const updateData: Partial<{
      reviewerId: string;
      reviewedAt: Date;
      reviewComment: string;
    }> = {};

    if (reviewData.reviewerId !== undefined) {
      updateData.reviewerId = reviewData.reviewerId;
    }
    if (reviewData.reviewedAt !== undefined) {
      updateData.reviewedAt = reviewData.reviewedAt;
    }
    if (reviewData.reviewComment !== undefined) {
      updateData.reviewComment = reviewData.reviewComment;
    }

    await this.update({ reportId }, updateData);
  }

  async findByReviewerId(reviewerId: string, limit = 50): Promise<ReportReviewEntity[]> {
    return this.find({
      where: { reviewerId },
      order: { reviewedAt: 'DESC' },
      take: limit,
    });
  }

  async getReviewStatsByReviewer(reviewerId: string): Promise<{
    totalReviews: number;
    reviewsThisMonth: number;
    averageReviewTime: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalReviews, reviewsThisMonth] = await Promise.all([
      this.count({ where: { reviewerId } }),
      this.count({
        where: {
          reviewerId,
          reviewedAt: MoreThanOrEqual(startOfMonth),
        },
      }),
    ]);

    // 평균 검토 시간 계산 (reports와 조인하여 생성일과 검토일 차이 계산)
    const averageTimeResult = await this.createQueryBuilder('review')
      .innerJoin('reports', 'report', 'review.reportId = report.id')
      .select('AVG(TIMESTAMPDIFF(HOUR, report.createdAt, review.reviewedAt))', 'avgHours')
      .where('review.reviewerId = :reviewerId', { reviewerId })
      .andWhere('review.reviewedAt IS NOT NULL')
      .getRawOne();

    const averageReviewTime = averageTimeResult?.avgHours
      ? Math.round(parseFloat(averageTimeResult.avgHours) * 100) / 100
      : 0;

    return {
      totalReviews,
      reviewsThisMonth,
      averageReviewTime,
    };
  }

  async deleteByReportId(reportId: string): Promise<void> {
    await this.delete({ reportId });
  }
}
