import { Injectable } from '@nestjs/common';

import { DataSource, In, LessThan, MoreThan, Between, IsNull } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentModerationEntity } from '../entities/content-moderation.entity.js';

export interface ContentModerationSearchOptions {
  moderationStatus?: 'active' | 'inactive' | 'flagged' | 'removed';
  moderatorId?: string;
  moderatedAfter?: Date;
  moderatedBefore?: Date;
  hasReason?: boolean;
  page?: number;
  limit?: LimitType;
  sortBy?: 'moderatedAt' | 'createdAt' | 'updatedAt';
  sortOrder?: SortOrderType;
}

@Injectable()
export class ContentModerationRepository extends BaseRepository<ContentModerationEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentModerationEntity, dataSource);
  }

  // ==================== 기본 조회는 서비스에서 BaseRepository 직접 사용 ====================

  // ==================== 복잡한 쿼리만 리포지토리에서 처리 ====================

  async searchModerations(
    options: ContentModerationSearchOptions
  ): Promise<PaginatedResult<ContentModerationEntity>> {
    const {
      moderationStatus,
      moderatorId,
      moderatedAfter,
      moderatedBefore,
      hasReason,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortBy = 'moderatedAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const moderationAlias = 'moderation';

    const qb = this.createQueryBuilder(moderationAlias);

    if (moderationStatus) {
      qb.andWhere(`${moderationAlias}.moderationStatus = :moderationStatus`, { moderationStatus });
    }

    if (moderatorId) {
      qb.andWhere(`${moderationAlias}.moderatorId = :moderatorId`, { moderatorId });
    }

    if (moderatedAfter) {
      qb.andWhere(`${moderationAlias}.moderatedAt >= :moderatedAfter`, { moderatedAfter });
    }

    if (moderatedBefore) {
      qb.andWhere(`${moderationAlias}.moderatedAt <= :moderatedBefore`, { moderatedBefore });
    }

    if (hasReason !== undefined) {
      if (hasReason) {
        qb.andWhere(`${moderationAlias}.reason IS NOT NULL`);
      } else {
        qb.andWhere(`${moderationAlias}.reason IS NULL`);
      }
    }

    qb.orderBy(`${moderationAlias}.${sortBy}`, sortOrder);
    qb.offset(skip).limit(limit);

    const [items, total] = await Promise.all([qb.getMany(), qb.getCount()]);

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

  async findByModerator(
    moderatorId: string,
    moderatedAfter?: Date,
    moderatedBefore?: Date
  ): Promise<ContentModerationEntity[]> {
    const where: any = { moderatorId };

    if (moderatedAfter && moderatedBefore) {
      where.moderatedAt = Between(moderatedAfter, moderatedBefore);
    } else if (moderatedAfter) {
      where.moderatedAt = MoreThan(moderatedAfter);
    } else if (moderatedBefore) {
      where.moderatedAt = LessThan(moderatedBefore);
    }

    return this.find({
      where,
      order: { moderatedAt: 'DESC' },
    });
  }

  async findPendingModeration(): Promise<ContentModerationEntity[]> {
    return this.find({
      where: {
        moderationStatus: 'flagged',
        moderatedAt: IsNull(),
      },
      order: { createdAt: 'ASC' }, // 오래된 것부터 처리
    });
  }

  async findFlaggedContent(limit?: number): Promise<ContentModerationEntity[]> {
    const queryOptions: any = {
      where: { moderationStatus: 'flagged' },
      order: { moderatedAt: 'DESC' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    return this.find(queryOptions);
  }

  async getModerationStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    active: number;
    inactive: number;
    flagged: number;
    removed: number;
    totalModerated: number;
  }> {
    const moderationAlias = 'moderation';
    const qb = this.createQueryBuilder(moderationAlias);

    if (startDate) {
      qb.andWhere(`${moderationAlias}.moderatedAt >= :startDate`, { startDate });
    }

    if (endDate) {
      qb.andWhere(`${moderationAlias}.moderatedAt <= :endDate`, { endDate });
    }

    const [active, inactive, flagged, removed, totalModerated] = await Promise.all([
      this.count({ where: { moderationStatus: 'active' } }),
      this.count({ where: { moderationStatus: 'inactive' } }),
      this.count({ where: { moderationStatus: 'flagged' } }),
      this.count({ where: { moderationStatus: 'removed' } }),
      startDate || endDate
        ? qb.getCount()
        : this.count({ where: { moderatedAt: MoreThan(new Date(0)) } }),
    ]);

    return {
      active,
      inactive,
      flagged,
      removed,
      totalModerated,
    };
  }

  async getModeratorActivity(
    moderatorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalActions: number;
    flaggedCount: number;
    removedCount: number;
    restoredCount: number; // inactive -> active
  }> {
    const moderationAlias = 'moderation';

    const totalActions = await this.createQueryBuilder(moderationAlias)
      .where(`${moderationAlias}.moderatorId = :moderatorId`, { moderatorId })
      .andWhere(`${moderationAlias}.moderatedAt BETWEEN :startDate AND :endDate`, {
        startDate,
        endDate,
      })
      .getCount();

    const [flaggedCount, removedCount, restoredCount] = await Promise.all([
      this.count({
        where: {
          moderatorId,
          moderationStatus: 'flagged',
          moderatedAt: Between(startDate, endDate),
        },
      }),
      this.count({
        where: {
          moderatorId,
          moderationStatus: 'removed',
          moderatedAt: Between(startDate, endDate),
        },
      }),
      this.count({
        where: {
          moderatorId,
          moderationStatus: 'active',
          moderatedAt: Between(startDate, endDate),
        },
      }),
    ]);

    return {
      totalActions,
      flaggedCount,
      removedCount,
      restoredCount,
    };
  }

  async batchUpdateModerationStatus(
    contentIds: string[],
    status: 'active' | 'inactive' | 'flagged' | 'removed',
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    if (contentIds.length === 0) return;

    const now = new Date();

    await this.update(
      { contentId: In(contentIds) },
      {
        moderationStatus: status,
        moderatorId,
        moderatedAt: now,
        ...(reason && { reason }),
        updatedAt: now,
      }
    );
  }
}
