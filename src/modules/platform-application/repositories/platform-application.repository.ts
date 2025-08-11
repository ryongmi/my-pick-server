import { Injectable } from '@nestjs/common';

import { DataSource, SelectQueryBuilder } from 'typeorm';

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
      .innerJoin('platform_application_data', 'data', 'data.applicationId = application.id')
      .where('application.creatorId = :creatorId', { creatorId })
      .andWhere('data.type = :platformType', { platformType })
      .andWhere('data.platformId = :platformId', { platformId })
      .andWhere('application.status IN (:...statuses)', {
        statuses: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED],
      })
      .getOne();
  }

  /**
   * 관리자용 신청 목록 검색
   */
  async searchApplications(query: PlatformApplicationSearchQueryDto): Promise<{
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
      queryBuilder.innerJoin(
        'platform_application_data',
        'data',
        'data.applicationId = application.id'
      );
      queryBuilder.andWhere('data.type = :type', {
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
      .innerJoin('platform_application_data', 'data', 'data.applicationId = application.id')
      .select('data.type', 'platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('data.type')
      .getRawMany();

    const totalByPlatform: Record<string, number> = {};
    platformStats.forEach((stat) => {
      totalByPlatform[stat.platform] = parseInt(stat.count, 10);
    });

    // 추가 통계 계산
    const total = pending + approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const rejectionRate = total > 0 ? Math.round((rejected / total) * 100) : 0;
    
    // 평균 처리 일수 계산 (승인 + 거부된 신청만)
    const avgProcessingDays = await this.getAverageProcessingDays();

    return {
      pending,
      approved,
      rejected,
      total,
      approvalRate,
      rejectionRate,
      avgProcessingDays,
      totalByPlatform,
    };
  }

  /**
   * 평균 처리 일수 계산
   */
  private async getAverageProcessingDays(): Promise<number> {
    const result = await this.createQueryBuilder('application')
      .select('AVG(DATEDIFF(application.reviewedAt, application.createdAt))', 'avgDays')
      .where('application.reviewedAt IS NOT NULL')
      .andWhere('application.status IN (:...statuses)', { 
        statuses: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED] 
      })
      .getRawOne();
      
    return result?.avgDays ? Math.round(parseFloat(result.avgDays)) : 0;
  }

  // ==================== 고급 통계 메서드 ====================

  async getApplicationStatsByStatus(): Promise<Array<{ status: ApplicationStatus; count: number }>> {
    const result = await this.createQueryBuilder('application')
      .select('application.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('application.status')
      .getRawMany();

    return result.map((item) => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }

  async getApplicationStatsByPlatformType(): Promise<Array<{ platformType: string; count: number }>> {
    const result = await this.createQueryBuilder('application')
      .innerJoin('platform_application_data', 'data', 'data.applicationId = application.id')
      .select('data.type', 'platformType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('data.type')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((item) => ({
      platformType: item.platformType,
      count: parseInt(item.count, 10),
    }));
  }

  async getMonthlyApplicationTrends(
    months = 12
  ): Promise<
    Array<{
      month: string;
      total: number;
      approved: number;
      rejected: number;
      pending: number;
    }>
  > {
    const result = await this.createQueryBuilder('application')
      .select("DATE_FORMAT(application.appliedAt, '%Y-%m')", 'month')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN application.status = 'approved' THEN 1 ELSE 0 END)",
        'approved'
      )
      .addSelect(
        "SUM(CASE WHEN application.status = 'rejected' THEN 1 ELSE 0 END)",
        'rejected'
      )
      .addSelect(
        "SUM(CASE WHEN application.status = 'pending' THEN 1 ELSE 0 END)",
        'pending'
      )
      .where('application.appliedAt >= DATE_SUB(CURRENT_DATE, INTERVAL :months MONTH)', {
        months,
      })
      .groupBy("DATE_FORMAT(application.appliedAt, '%Y-%m')")
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      month: item.month,
      total: parseInt(item.total, 10),
      approved: parseInt(item.approved || '0', 10),
      rejected: parseInt(item.rejected || '0', 10),
      pending: parseInt(item.pending || '0', 10),
    }));
  }

  async getApprovalRateByPlatform(): Promise<
    Array<{
      platformType: string;
      totalApplications: number;
      approvedApplications: number;
    }>
  > {
    const result = await this.createQueryBuilder('application')
      .innerJoin('platform_application_data', 'data', 'data.applicationId = application.id')
      .select('data.type', 'platformType')
      .addSelect('COUNT(*)', 'totalApplications')
      .addSelect(
        "SUM(CASE WHEN application.status = 'approved' THEN 1 ELSE 0 END)",
        'approvedApplications'
      )
      .groupBy('data.type')
      .getRawMany();

    return result.map((item) => ({
      platformType: item.platformType,
      totalApplications: parseInt(item.totalApplications, 10),
      approvedApplications: parseInt(item.approvedApplications || '0', 10),
    }));
  }

  async getAverageReviewTime(): Promise<number> {
    const result = await this.createQueryBuilder('application')
      .select(
        'AVG(TIMESTAMPDIFF(HOUR, application.appliedAt, application.reviewedAt))',
        'averageHours'
      )
      .where('application.status IN (:...statuses)', {
        statuses: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED],
      })
      .andWhere('application.reviewedAt IS NOT NULL')
      .getRawOne();

    return parseFloat(result.averageHours || '0');
  }

  async getTopRejectionReasons(limit = 10): Promise<Array<{ reason: string; count: number }>> {
    const result = await this.createQueryBuilder('application')
      .innerJoin('platform_application_review', 'review', 'review.applicationId = application.id')
      .select('review.customReason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('application.status = :status', { status: ApplicationStatus.REJECTED })
      .andWhere('review.customReason IS NOT NULL')
      .andWhere('review.customReason != ""')
      .groupBy('review.customReason')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((item) => ({
      reason: item.reason,
      count: parseInt(item.count, 10),
    }));
  }

  // ==================== 배치 처리 메서드 ====================

  async getBulkApplicationStatusCounts(applicationIds: string[]): Promise<Record<string, ApplicationStatus>> {
    if (applicationIds.length === 0) return {};

    const result = await this.createQueryBuilder('application')
      .select('application.id', 'id')
      .addSelect('application.status', 'status')
      .where('application.id IN (:...applicationIds)', { applicationIds })
      .getRawMany();

    const statusMap: Record<string, ApplicationStatus> = {};
    result.forEach((item) => {
      statusMap[item.id] = item.status;
    });

    return statusMap;
  }

  async getApplicationsWithUserInfo(applicationIds: string[]): Promise<
    Array<{
      applicationId: string;
      userId: string;
      creatorId: string;
      status: ApplicationStatus;
    }>
  > {
    if (applicationIds.length === 0) return [];

    const result = await this.createQueryBuilder('application')
      .select('application.id', 'applicationId')
      .addSelect('application.userId', 'userId')
      .addSelect('application.creatorId', 'creatorId')
      .addSelect('application.status', 'status')
      .where('application.id IN (:...applicationIds)', { applicationIds })
      .getRawMany();

    return result.map((item) => ({
      applicationId: item.applicationId,
      userId: item.userId,
      creatorId: item.creatorId,
      status: item.status,
    }));
  }
}
