import { Injectable } from '@nestjs/common';

import { DataSource, Repository, Between, MoreThan } from 'typeorm';

import { ReportEntity } from '../entities/index.js';
import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';

@Injectable()
export class ReportRepository extends Repository<ReportEntity> {
  constructor(private dataSource: DataSource) {
    super(ReportEntity, dataSource.createEntityManager());
  }

  // ==================== 기본 CRUD 메서드 ====================

  async createReport(reportData: Partial<ReportEntity>): Promise<ReportEntity> {
    const report = this.create(reportData);
    return await this.save(report);
  }

  async findById(reportId: string): Promise<ReportEntity | null> {
    return this.findOne({ where: { id: reportId } });
  }

  async updateReport(reportId: string, updateData: Partial<ReportEntity>): Promise<void> {
    await this.update({ id: reportId }, updateData);
  }

  async deleteReport(reportId: string): Promise<void> {
    await this.delete({ id: reportId });
  }

  // ==================== 검색 및 필터링 메서드 ====================

  async findByReporter(reporterId: string, limit?: number): Promise<ReportEntity[]> {
    const findOptions: {
      where: { reporterId: string };
      order: { createdAt: 'DESC' };
      take?: number;
    } = {
      where: { reporterId },
      order: { createdAt: 'DESC' },
    };

    if (limit !== undefined) {
      findOptions.take = limit;
    }

    return this.find(findOptions);
  }

  async findByTarget(targetType: ReportTargetType, targetId: string): Promise<ReportEntity[]> {
    return this.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: ReportStatus, limit?: number): Promise<ReportEntity[]> {
    const findOptions: {
      where: { status: ReportStatus };
      order: { createdAt: 'ASC' };
      take?: number;
    } = {
      where: { status },
      order: { createdAt: 'ASC' }, // 오래된 신고부터 처리
    };

    if (limit !== undefined) {
      findOptions.take = limit;
    }

    return this.find(findOptions);
  }

  async findPendingReports(limit?: number): Promise<ReportEntity[]> {
    const findOptions: {
      where: { status: ReportStatus };
      order: { priority: 'ASC'; createdAt: 'ASC' };
      take?: number;
    } = {
      where: { status: ReportStatus.PENDING },
      order: { priority: 'ASC', createdAt: 'ASC' }, // 우선순위, 생성시간 순
    };

    if (limit !== undefined) {
      findOptions.take = limit;
    }

    return this.find(findOptions);
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.count();
  }

  async getCountByStatus(status: ReportStatus): Promise<number> {
    return this.count({ where: { status } });
  }

  async getCountByTarget(targetType: ReportTargetType, targetId: string): Promise<number> {
    return this.count({ where: { targetType, targetId } });
  }

  async getCountByReporter(reporterId: string): Promise<number> {
    return this.count({ where: { reporterId } });
  }

  async getReportsInDateRange(startDate: Date, endDate: Date): Promise<ReportEntity[]> {
    return this.find({
      where: { createdAt: Between(startDate, endDate) },
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== 중복 신고 확인 ====================

  async findDuplicateReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string
  ): Promise<ReportEntity | null> {
    return this.findOne({
      where: {
        reporterId,
        targetType,
        targetId,
        status: ReportStatus.PENDING, // 처리 중인 신고만 확인
      },
    });
  }

  // ==================== 최적화된 쿼리 메서드 ====================

  async getReportStatsByTargetType(): Promise<
    Array<{
      targetType: ReportTargetType;
      count: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.targetType', 'targetType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.targetType')
      .getRawMany();

    return result.map((item) => ({
      targetType: item.targetType,
      count: parseInt(item.count, 10),
    }));
  }

  async getReportStatsByStatus(): Promise<
    Array<{
      status: ReportStatus;
      count: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.status')
      .getRawMany();

    return result.map((item) => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }

  // ==================== 강화된 통계 메서드 ====================

  async getReportStatsByReason(): Promise<
    Array<{
      reason: ReportReason;
      count: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.reason')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result.map((item) => ({
      reason: item.reason,
      count: parseInt(item.count, 10),
    }));
  }

  async getReportsThisMonth(): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.count({
      where: { createdAt: MoreThan(startOfMonth) },
    });
  }

  async getTopReportedTargets(
    limit = 10
  ): Promise<
    Array<{
      targetType: ReportTargetType;
      targetId: string;
      count: number;
      lastReportedAt: Date;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.targetType', 'targetType')
      .addSelect('report.targetId', 'targetId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(report.createdAt)', 'lastReportedAt')
      .groupBy('report.targetType, report.targetId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((item) => ({
      targetType: item.targetType,
      targetId: item.targetId,
      count: parseInt(item.count, 10),
      lastReportedAt: new Date(item.lastReportedAt),
    }));
  }

  async getReportTrends(days = 30): Promise<
    Array<{
      date: string;
      count: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.createQueryBuilder('report')
      .select('DATE(report.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('report.createdAt >= :startDate', { startDate })
      .groupBy('DATE(report.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      date: item.date,
      count: parseInt(item.count, 10),
    }));
  }

  // ==================== 고급 통계 메서드 ====================

  async getReportStatsByPriority(): Promise<
    Array<{
      priority: number;
      count: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.priority')
      .orderBy('report.priority', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      priority: parseInt(item.priority, 10),
      count: parseInt(item.count, 10),
    }));
  }

  async getMonthlyReportTrends(
    months = 12
  ): Promise<
    Array<{
      month: string;
      total: number;
      resolved: number;
      pending: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select("DATE_FORMAT(report.createdAt, '%Y-%m')", 'month')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN report.status = 'resolved' THEN 1 ELSE 0 END)",
        'resolved'
      )
      .addSelect(
        "SUM(CASE WHEN report.status = 'pending' THEN 1 ELSE 0 END)",
        'pending'
      )
      .where('report.createdAt >= DATE_SUB(CURRENT_DATE, INTERVAL :months MONTH)', {
        months,
      })
      .groupBy("DATE_FORMAT(report.createdAt, '%Y-%m')")
      .orderBy('month', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      month: item.month,
      total: parseInt(item.total, 10),
      resolved: parseInt(item.resolved || '0', 10),
      pending: parseInt(item.pending || '0', 10),
    }));
  }

  async getTotalReportersCount(): Promise<number> {
    const result = await this.createQueryBuilder('report')
      .select('COUNT(DISTINCT report.reporterId)', 'count')
      .getRawOne();

    return parseInt(result.count, 10);
  }

  async getActiveReportersThisMonth(): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.createQueryBuilder('report')
      .select('COUNT(DISTINCT report.reporterId)', 'count')
      .where('report.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    return parseInt(result.count, 10);
  }

  async getTopReporters(
    limit = 10
  ): Promise<
    Array<{
      reporterId: string;
      reportCount: number;
      lastReportAt: Date;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.reporterId', 'reporterId')
      .addSelect('COUNT(*)', 'reportCount')
      .addSelect('MAX(report.createdAt)', 'lastReportAt')
      .groupBy('report.reporterId')
      .orderBy('reportCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((item) => ({
      reporterId: item.reporterId,
      reportCount: parseInt(item.reportCount, 10),
      lastReportAt: new Date(item.lastReportAt),
    }));
  }

  async getAverageResolutionTime(): Promise<number> {
    const result = await this.createQueryBuilder('report')
      .leftJoin('report_review', 'review', 'review.reportId = report.id')
      .select(
        'AVG(TIMESTAMPDIFF(HOUR, report.createdAt, review.reviewedAt))',
        'averageHours'
      )
      .where('report.status IN (:...statuses)', {
        statuses: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
      })
      .andWhere('review.reviewedAt IS NOT NULL')
      .getRawOne();

    return parseFloat(result.averageHours || '0');
  }

  async getMedianResolutionTime(): Promise<number> {
    // 대부분의 데이터베이스에서 중앙값 계산은 복잡하므로 근사치 제공
    const result = await this.createQueryBuilder('report')
      .leftJoin('report_review', 'review', 'review.reportId = report.id')
      .select(
        'TIMESTAMPDIFF(HOUR, report.createdAt, review.reviewedAt)',
        'resolutionHours'
      )
      .where('report.status IN (:...statuses)', {
        statuses: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
      })
      .andWhere('review.reviewedAt IS NOT NULL')
      .orderBy('resolutionHours', 'ASC')
      .getRawMany();

    if (result.length === 0) return 0;

    const values = result.map((r) => parseFloat(r.resolutionHours || '0'));
    const middle = Math.floor(values.length / 2);

    if (values.length % 2 === 0) {
      return (values[middle - 1]! + values[middle]!) / 2;
    } else {
      return values[middle]!;
    }
  }

  async getResolutionTimesByPriority(): Promise<
    Array<{
      priority: number;
      averageHours: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .leftJoin('report_review', 'review', 'review.reportId = report.id')
      .select('report.priority', 'priority')
      .addSelect(
        'AVG(TIMESTAMPDIFF(HOUR, report.createdAt, review.reviewedAt))',
        'averageHours'
      )
      .where('report.status IN (:...statuses)', {
        statuses: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
      })
      .andWhere('review.reviewedAt IS NOT NULL')
      .groupBy('report.priority')
      .orderBy('report.priority', 'ASC')
      .getRawMany();

    return result.map((item) => ({
      priority: parseInt(item.priority, 10),
      averageHours: parseFloat(item.averageHours || '0'),
    }));
  }

  // ==================== 성능 최적화된 배치 메서드 ====================

  async getReportsWithEvidenceCount(): Promise<
    Array<{
      reportId: string;
      hasEvidence: boolean;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .leftJoin('report_evidence', 'evidence', 'evidence.reportId = report.id')
      .select('report.id', 'reportId')
      .addSelect('CASE WHEN evidence.reportId IS NOT NULL THEN true ELSE false END', 'hasEvidence')
      .getRawMany();

    return result.map((item) => ({
      reportId: item.reportId,
      hasEvidence: item.hasEvidence === 1 || item.hasEvidence === true,
    }));
  }

  async getBulkReportStatusCounts(reportIds: string[]): Promise<Record<string, ReportStatus>> {
    if (reportIds.length === 0) return {};

    const result = await this.createQueryBuilder('report')
      .select('report.id', 'id')
      .addSelect('report.status', 'status')
      .where('report.id IN (:...reportIds)', { reportIds })
      .getRawMany();

    const statusMap: Record<string, ReportStatus> = {};
    result.forEach((item) => {
      statusMap[item.id] = item.status;
    });

    return statusMap;
  }
}
