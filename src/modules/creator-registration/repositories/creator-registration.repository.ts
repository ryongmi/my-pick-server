import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { CreatorRegistrationEntity } from '../entities/creator-registration.entity.js';
import { RegistrationStatus } from '../enums/index.js';

@Injectable()
export class CreatorRegistrationRepository extends BaseRepository<CreatorRegistrationEntity> {
  constructor(dataSource: DataSource) {
    super(CreatorRegistrationEntity, dataSource);
  }

  // ==================== CUSTOM QUERY METHODS ====================

  /**
   * 사용자의 활성 신청 확인 (PENDING만)
   */
  async hasActiveRegistration(userId: string): Promise<boolean> {
    const count = await this.count({
      where: {
        userId,
        status: RegistrationStatus.PENDING,
      },
    });

    return count > 0;
  }

  /**
   * 신청 검색 (관리자용, 페이지네이션)
   */
  async searchRegistrations(options: {
    status?: RegistrationStatus;
    limit?: number;
    offset?: number;
  }): Promise<[CreatorRegistrationEntity[], number]> {
    const qb = this.createQueryBuilder('registration');

    if (options.status) {
      qb.where('registration.status = :status', { status: options.status });
    }

    qb.orderBy('registration.appliedAt', 'DESC');

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
  async countByStatus(status: RegistrationStatus): Promise<number> {
    return this.count({ where: { status } });
  }

  /**
   * 사용자의 최신 신청 조회
   */
  async findLatestByUserId(userId: string): Promise<CreatorRegistrationEntity | null> {
    return this.findOne({
      where: { userId },
      order: { appliedAt: 'DESC' },
    });
  }
}

