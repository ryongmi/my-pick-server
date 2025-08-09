import { Injectable } from '@nestjs/common';

import { DataSource, Repository, FindManyOptions, Between, MoreThan } from 'typeorm';

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
    const findOptions: any = {
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
    const findOptions: any = {
      where: { status },
      order: { createdAt: 'ASC' }, // 오래된 신고부터 처리
    };

    if (limit !== undefined) {
      findOptions.take = limit;
    }

    return this.find(findOptions);
  }

  async findPendingReports(limit?: number): Promise<ReportEntity[]> {
    const findOptions: any = {
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
    targetType: ReportTargetType,
    limit = 10
  ): Promise<
    Array<{
      targetId: string;
      count: number;
    }>
  > {
    const result = await this.createQueryBuilder('report')
      .select('report.targetId', 'targetId')
      .addSelect('COUNT(*)', 'count')
      .where('report.targetType = :targetType', { targetType })
      .groupBy('report.targetId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((item) => ({
      targetId: item.targetId,
      count: parseInt(item.count, 10),
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
}
