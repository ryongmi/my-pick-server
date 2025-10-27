import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorApplicationEntity, ApplicationStatus } from '../entities/creator-application.entity.js';

@Injectable()
export class CreatorApplicationRepository extends BaseRepository<CreatorApplicationEntity> {
  constructor(dataSource: DataSource) {
    super(CreatorApplicationEntity, dataSource);
  }

  // ==================== CUSTOM QUERY METHODS ====================

  /**
   * 사용자의 활성 신청 확인 (PENDING만)
   */
  async hasActiveApplication(userId: string): Promise<boolean> {
    const count = await this.count({
      where: {
        userId,
        status: ApplicationStatus.PENDING,
      },
    });

    return count > 0;
  }

  /**
   * 신청 검색 (관리자용, 페이지네이션)
   */
  async searchApplications(options: {
    status?: ApplicationStatus;
    limit?: number;
    offset?: number;
  }): Promise<[CreatorApplicationEntity[], number]> {
    const qb = this.createQueryBuilder('app');

    if (options.status) {
      qb.where('app.status = :status', { status: options.status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    if (options.limit) {
      qb.take(options.limit);
    }

    if (options.offset) {
      qb.skip(options.offset);
    }

    return qb.getManyAndCount();
  }

  /**
   * 상태별 카운트
   */
  async countByStatus(status: ApplicationStatus): Promise<number> {
    return this.count({ where: { status } });
  }

  /**
   * 사용자의 최신 신청 조회
   */
  async findLatestByUserId(userId: string): Promise<CreatorApplicationEntity | null> {
    return this.findOne({
      where: { userId },
      order: { appliedAt: 'DESC' },
    });
  }
}
