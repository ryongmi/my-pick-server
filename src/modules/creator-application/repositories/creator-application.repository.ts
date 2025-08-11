import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorApplicationEntity } from '../entities/index.js';
import { ApplicationStatus } from '../enums/index.js';

export interface ApplicationSearchOptions {
  status?: ApplicationStatus;
  userId?: string;
  page?: number;
  limit?: LimitType;
  sortBy?: 'appliedAt' | 'reviewedAt';
  sortOrder?: SortOrderType;
}

@Injectable()
export class CreatorApplicationRepository extends BaseRepository<CreatorApplicationEntity> {
  constructor(private dataSource: DataSource) {
    super(CreatorApplicationEntity, dataSource);
  }

  async searchApplications(
    options: ApplicationSearchOptions
  ): Promise<PaginatedResult<Partial<CreatorApplicationEntity>>> {
    const {
      status,
      userId,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortBy = 'appliedAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const applicationAlias = 'application';

    const qb = this.createQueryBuilder(applicationAlias).select([
      `${applicationAlias}.id AS id`,
      `${applicationAlias}.userId AS userId`,
      `${applicationAlias}.status AS status`,
      `${applicationAlias}.appliedAt AS appliedAt`,
      `${applicationAlias}.reviewedAt AS reviewedAt`,
      `${applicationAlias}.reviewerId AS reviewerId`,
      `${applicationAlias}.applicationData AS applicationData`,
      `${applicationAlias}.reviewData AS reviewData`,
    ]);

    if (status) {
      qb.andWhere(`${applicationAlias}.status = :status`, { status });
    }

    if (userId) {
      qb.andWhere(`${applicationAlias}.userId = :userId`, { userId });
    }

    qb.orderBy(`${applicationAlias}.${sortBy}`, sortOrder);
    qb.offset(skip).limit(limit);

    // 최적화: 병렬로 COUNT와 데이터 조회
    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);

    // 타입 안전한 결과 매핑
    const items: Partial<CreatorApplicationEntity>[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      status: row.status,
      appliedAt: row.appliedAt,
      reviewedAt: row.reviewedAt,
      reviewerId: row.reviewerId,
      applicationData: row.applicationData,
      reviewData: row.reviewData,
    }));

    const totalPages = Math.ceil(total / limit);
    const pageInfo = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    };

    return { items, pageInfo };
  }

  // 기본 변경/조회 메서드들은 BaseRepository 직접 사용 (saveEntity, exists, count 등)

  async hasActiveApplication(userId: string): Promise<boolean> {
    return this.exists({
      userId,
      status: ApplicationStatus.PENDING,
    });
  }

  async countByStatus(status: ApplicationStatus): Promise<number> {
    return this.count({ where: { status } });
  }

  // ==================== 추가 조회 메서드 ====================

  async findApplicationsByIds(applicationIds: string[]): Promise<CreatorApplicationEntity[]> {
    if (applicationIds.length === 0) {
      return [];
    }
    return this.createQueryBuilder('application')
      .where('application.id IN (:...ids)', { ids: applicationIds })
      .getMany();
  }

  async findByUserIds(userIds: string[]): Promise<CreatorApplicationEntity[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.createQueryBuilder('application')
      .where('application.userId IN (:...userIds)', { userIds })
      .orderBy('application.appliedAt', 'DESC')
      .getMany();
  }

  async countActiveApplications(userId: string): Promise<number> {
    return this.count({ 
      where: { 
        userId,
        status: ApplicationStatus.PENDING 
      } 
    });
  }

  async findPendingByPriority(): Promise<CreatorApplicationEntity[]> {
    return this.find({
      where: { status: ApplicationStatus.PENDING },
      order: { priority: 'DESC', appliedAt: 'ASC' }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<CreatorApplicationEntity[]> {
    return this.createQueryBuilder('application')
      .where('application.appliedAt >= :startDate', { startDate })
      .andWhere('application.appliedAt <= :endDate', { endDate })
      .orderBy('application.appliedAt', 'DESC')
      .getMany();
  }

  async findProcessedApplications(): Promise<CreatorApplicationEntity[]> {
    return this.find({
      where: [
        { status: ApplicationStatus.APPROVED },
        { status: ApplicationStatus.REJECTED }
      ],
      order: { reviewedAt: 'DESC' }
    });
  }

  // ==================== 통계 메서드 ====================

  async getApplicationTrendsByDays(days: number): Promise<Array<{
    period: string;
    total: number;
    approved: number;
    rejected: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.createQueryBuilder('application')
      .select('DATE(application.appliedAt) as period')
      .addSelect('COUNT(*) as total')
      .addSelect('SUM(CASE WHEN application.status = :approved THEN 1 ELSE 0 END) as approved')
      .addSelect('SUM(CASE WHEN application.status = :rejected THEN 1 ELSE 0 END) as rejected')
      .where('application.appliedAt >= :startDate', { startDate })
      .setParameter('approved', ApplicationStatus.APPROVED)
      .setParameter('rejected', ApplicationStatus.REJECTED)
      .groupBy('DATE(application.appliedAt)')
      .orderBy('period', 'ASC')
      .getRawMany();

    return result.map(row => ({
      period: row.period,
      total: parseInt(row.total, 10),
      approved: parseInt(row.approved, 10),
      rejected: parseInt(row.rejected, 10),
    }));
  }

  async getReviewerStats(days: number): Promise<Array<{
    reviewerId: string;
    totalReviews: number;
    approvals: number;
    rejections: number;
    avgProcessingDays: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.createQueryBuilder('application')
      .select('application.reviewerId as reviewerId')
      .addSelect('COUNT(*) as totalReviews')
      .addSelect('SUM(CASE WHEN application.status = :approved THEN 1 ELSE 0 END) as approvals')
      .addSelect('SUM(CASE WHEN application.status = :rejected THEN 1 ELSE 0 END) as rejections')
      .addSelect('AVG(DATEDIFF(application.reviewedAt, application.appliedAt)) as avgProcessingDays')
      .where('application.reviewedAt >= :startDate', { startDate })
      .andWhere('application.reviewerId IS NOT NULL')
      .setParameter('approved', ApplicationStatus.APPROVED)
      .setParameter('rejected', ApplicationStatus.REJECTED)
      .groupBy('application.reviewerId')
      .orderBy('totalReviews', 'DESC')
      .getRawMany();

    return result.map(row => ({
      reviewerId: row.reviewerId,
      totalReviews: parseInt(row.totalReviews, 10),
      approvals: parseInt(row.approvals, 10),
      rejections: parseInt(row.rejections, 10),
      avgProcessingDays: parseFloat(row.avgProcessingDays) || 0,
    }));
  }
}
