import { Injectable } from '@nestjs/common';

import { DataSource, LessThan } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';
import { LimitType, SortOrderType } from '@krgeobuk/core/enum';
import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { ContentSyncEntity } from '../entities/content-sync.entity.js';

export interface ContentSyncSearchOptions {
  syncStatus?: 'pending' | 'syncing' | 'completed' | 'failed';
  platform?: string;
  isAuthorizedData?: boolean;
  expiresAtBefore?: Date;
  expiresAtAfter?: Date;
  page?: number;
  limit?: LimitType;
  sortBy?: 'lastSyncedAt' | 'expiresAt' | 'nextSyncAt';
  sortOrder?: SortOrderType;
}

@Injectable()
export class ContentSyncRepository extends BaseRepository<ContentSyncEntity> {
  constructor(private dataSource: DataSource) {
    super(ContentSyncEntity, dataSource);
  }

  // ==================== 기본 조회는 서비스에서 BaseRepository 직접 사용 ====================

  async searchContentSync(
    options: ContentSyncSearchOptions
  ): Promise<PaginatedResult<ContentSyncEntity>> {
    const {
      syncStatus,
      platform,
      isAuthorizedData,
      expiresAtBefore,
      expiresAtAfter,
      page = 1,
      limit = LimitType.FIFTEEN,
      sortBy = 'lastSyncedAt',
      sortOrder = SortOrderType.DESC,
    } = options;

    const skip = (page - 1) * limit;
    const syncAlias = 'sync';

    const qb = this.createQueryBuilder(syncAlias);

    if (syncStatus) {
      qb.andWhere(`${syncAlias}.syncStatus = :syncStatus`, { syncStatus });
    }

    if (platform) {
      qb.andWhere(`${syncAlias}.platform = :platform`, { platform });
    }

    if (isAuthorizedData !== undefined) {
      qb.andWhere(`${syncAlias}.isAuthorizedData = :isAuthorizedData`, { isAuthorizedData });
    }

    if (expiresAtBefore) {
      qb.andWhere(`${syncAlias}.expiresAt < :expiresAtBefore`, { expiresAtBefore });
    }

    if (expiresAtAfter) {
      qb.andWhere(`${syncAlias}.expiresAt > :expiresAtAfter`, { expiresAtAfter });
    }

    qb.orderBy(`${syncAlias}.${sortBy}`, sortOrder);
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

  // ==================== YouTube API 정책 준수 메서드 ====================

  async findExpiredContent(): Promise<ContentSyncEntity[]> {
    const now = new Date();
    return this.find({
      where: {
        expiresAt: LessThan(now),
        isAuthorizedData: false, // 비인증 데이터만 만료 처리
      },
      order: { expiresAt: 'ASC' },
    });
  }

  async findExpiredAuthorizedData(): Promise<ContentSyncEntity[]> {
    const now = new Date();
    return this.find({
      where: {
        expiresAt: LessThan(now),
        isAuthorizedData: true, // 인증 데이터는 연장 처리
      },
      order: { expiresAt: 'ASC' },
    });
  }

  async findNonConsentedCreatorSync(creatorId: string): Promise<ContentSyncEntity[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return this.createQueryBuilder('sync')
      .leftJoin('content', 'content', 'content.id = sync.contentId')
      .where('content.creatorId = :creatorId', { creatorId })
      .andWhere('sync.isAuthorizedData = :isAuthorized', { isAuthorized: false })
      .andWhere('sync.lastSyncedAt < :thirtyDaysAgo', { thirtyDaysAgo })
      .getMany();
  }

  async findPendingSync(limit?: number): Promise<ContentSyncEntity[]> {
    const queryOptions: {
      where: { syncStatus: 'pending' };
      order: { nextSyncAt: 'ASC' };
      take?: number;
    } = {
      where: { syncStatus: 'pending' },
      order: { nextSyncAt: 'ASC' },
    };

    if (limit) {
      queryOptions.take = limit;
    }

    return this.find(queryOptions);
  }

  async findFailedSync(retryLimit: number = 3): Promise<ContentSyncEntity[]> {
    return this.createQueryBuilder('sync')
      .where('sync.syncStatus = :status', { status: 'failed' })
      .andWhere('sync.syncRetryCount < :retryLimit', { retryLimit })
      .orderBy('sync.updatedAt', 'ASC')
      .getMany();
  }

  async findSyncDue(): Promise<ContentSyncEntity[]> {
    const now = new Date();
    return this.find({
      where: {
        nextSyncAt: LessThan(now),
        syncStatus: 'completed',
      },
      order: { nextSyncAt: 'ASC' },
    });
  }

  // ==================== 단순 카운트는 서비스에서 BaseRepository 직접 사용 ====================

  // ==================== 단순 존재확인과 배치조회는 서비스에서 BaseRepository 직접 사용 ====================
}
