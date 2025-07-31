import { Injectable } from '@nestjs/common';

import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { BaseRepository } from '@krgeobuk/core/repositories';

import { PlatformApplicationEntity } from '../entities/index.js';
import { ApplicationStatus } from '../enums/index.js';
import { PlatformApplicationSearchQueryDto, ApplicationStatsDto } from '../dto/index.js';

@Injectable()
export class PlatformApplicationRepository extends BaseRepository<PlatformApplicationEntity> {
  constructor(dataSource: DataSource) {
    super(PlatformApplicationEntity, dataSource);
  }

  /**
   * 사용자별 플랫폼 신청 목록 조회
   */
  async findByUserId(userId: string): Promise<PlatformApplicationEntity[]> {
    return this.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 크리에이터별 플랫폼 신청 목록 조회
   */
  async findByCreatorId(creatorId: string): Promise<PlatformApplicationEntity[]> {
    return this.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 상태별 신청 수 조회
   */
  async countByStatus(status: ApplicationStatus): Promise<number> {
    return this.count({
      where: { status },
    });
  }

  /**
   * 중복 신청 확인
   */
  async findExistingApplication(
    creatorId: string,
    platformType: string,
    platformId: string
  ): Promise<PlatformApplicationEntity | null> {
    return this.createQueryBuilder('application')
      .where('application.creatorId = :creatorId', { creatorId })
      .andWhere('JSON_EXTRACT(application.platformData, "$.type") = :platformType', { platformType })
      .andWhere('JSON_EXTRACT(application.platformData, "$.platformId") = :platformId', { platformId })
      .andWhere('application.status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
      })
      .getOne();
  }

  /**
   * 관리자용 신청 목록 검색
   */
  async searchApplications(
    query: PlatformApplicationSearchQueryDto
  ): Promise<{
    items: PlatformApplicationEntity[];
    total: number;
  }> {
    const queryBuilder = this.createQueryBuilder('application');

    // 필터 조건 적용
    this.applySearchFilters(queryBuilder, query);

    // 정렬 조건
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`application.${sortBy}`, sortOrder);

    // 페이지네이션
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    // 실행
    const [items, total] = await queryBuilder.getManyAndCount();

    return { items, total };
  }

  /**
   * 검색 필터 적용
   */
  private applySearchFilters(
    queryBuilder: SelectQueryBuilder<PlatformApplicationEntity>,
    query: PlatformApplicationSearchQueryDto
  ): void {
    if (query.status) {
      queryBuilder.andWhere('application.status = :status', { status: query.status });
    }

    if (query.type) {
      queryBuilder.andWhere('JSON_EXTRACT(application.platformData, "$.type") = :type', {
        type: query.type,
      });
    }

    if (query.creatorId) {
      queryBuilder.andWhere('application.creatorId = :creatorId', { creatorId: query.creatorId });
    }

    if (query.reviewerId) {
      queryBuilder.andWhere('application.reviewerId = :reviewerId', {
        reviewerId: query.reviewerId,
      });
    }
  }

  /**
   * 통계 정보 조회
   */
  async getApplicationStats(): Promise<ApplicationStatsDto> {
    const [pending, approved, rejected] = await Promise.all([
      this.countByStatus(ApplicationStatus.PENDING),
      this.countByStatus(ApplicationStatus.APPROVED),
      this.countByStatus(ApplicationStatus.REJECTED),
    ]);

    // 플랫폼별 통계
    const platformStats = await this.createQueryBuilder('application')
      .select('JSON_EXTRACT(application.platformData, "$.type")', 'platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('platform')
      .getRawMany();

    const totalByPlatform: Record<string, number> = {};
    platformStats.forEach((stat) => {
      totalByPlatform[stat.platform] = parseInt(stat.count, 10);
    });

    return {
      pending,
      approved,
      rejected,
      totalByPlatform,
    };
  }
}