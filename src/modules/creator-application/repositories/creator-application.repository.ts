import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CreatorApplicationEntity, ApplicationStatus } from '../entities/index.js';

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

  // 기본 조회 메서드들은 BaseRepository 직접 사용 (findOneById, findOne 등)

  async findByUserId(userId: string): Promise<CreatorApplicationEntity | null> {
    return this.findOne({
      where: { userId },
      order: { appliedAt: 'DESC' },
    });
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
}

