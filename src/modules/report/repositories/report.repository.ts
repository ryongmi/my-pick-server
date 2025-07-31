import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';

import { ReportEntity } from '../entities/index.js';
import { ReportStatus, ReportTargetType } from '../enums/index.js';

@Injectable()
export class ReportRepository {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepo: Repository<ReportEntity>,
  ) {}

  // ==================== 기본 CRUD 메서드 ====================

  async create(reportData: Partial<ReportEntity>): Promise<ReportEntity> {
    const report = this.reportRepo.create(reportData);
    return await this.reportRepo.save(report);
  }

  async findById(reportId: string): Promise<ReportEntity | null> {
    return await this.reportRepo.findOne({
      where: { id: reportId },
    });
  }

  async update(reportId: string, updateData: Partial<ReportEntity>): Promise<void> {
    await this.reportRepo.update(reportId, updateData);
  }

  async delete(reportId: string): Promise<void> {
    await this.reportRepo.delete(reportId);
  }

  // ==================== 검색 및 필터링 메서드 ====================

  async findMany(options: FindManyOptions<ReportEntity>): Promise<ReportEntity[]> {
    return await this.reportRepo.find(options);
  }

  async findAndCount(options: FindManyOptions<ReportEntity>): Promise<[ReportEntity[], number]> {
    return await this.reportRepo.findAndCount(options);
  }

  async findByReporter(reporterId: string, limit?: number): Promise<ReportEntity[]> {
    return await this.reportRepo.find({
      where: { reporterId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByTarget(targetType: ReportTargetType, targetId: string): Promise<ReportEntity[]> {
    return await this.reportRepo.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: ReportStatus, limit?: number): Promise<ReportEntity[]> {
    return await this.reportRepo.find({
      where: { status },
      order: { createdAt: 'ASC' }, // 오래된 신고부터 처리
      take: limit,
    });
  }

  async findPendingReports(limit?: number): Promise<ReportEntity[]> {
    return await this.reportRepo.find({
      where: { status: ReportStatus.PENDING },
      order: { priority: 'ASC', createdAt: 'ASC' }, // 우선순위, 생성시간 순
      take: limit,
    });
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return await this.reportRepo.count();
  }

  async getCountByStatus(status: ReportStatus): Promise<number> {
    return await this.reportRepo.count({
      where: { status },
    });
  }

  async getCountByTarget(targetType: ReportTargetType, targetId: string): Promise<number> {
    return await this.reportRepo.count({
      where: { targetType, targetId },
    });
  }

  async getCountByReporter(reporterId: string): Promise<number> {
    return await this.reportRepo.count({
      where: { reporterId },
    });
  }

  async getReportsInDateRange(startDate: Date, endDate: Date): Promise<ReportEntity[]> {
    return await this.reportRepo.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== 중복 신고 확인 ====================

  async findDuplicateReport(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<ReportEntity | null> {
    return await this.reportRepo.findOne({
      where: {
        reporterId,
        targetType,
        targetId,
        status: ReportStatus.PENDING, // 처리 중인 신고만 확인
      },
    });
  }

  // ==================== 최적화된 쿼리 메서드 ====================

  async getReportStatsByTargetType(): Promise<Array<{
    targetType: ReportTargetType;
    count: number;
  }>> {
    const result = await this.reportRepo
      .createQueryBuilder('report')
      .select('report.targetType', 'targetType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.targetType')
      .getRawMany();

    return result.map(item => ({
      targetType: item.targetType,
      count: parseInt(item.count, 10),
    }));
  }

  async getReportStatsByStatus(): Promise<Array<{
    status: ReportStatus;
    count: number;
  }>> {
    const result = await this.reportRepo
      .createQueryBuilder('report')
      .select('report.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.status')
      .getRawMany();

    return result.map(item => ({
      status: item.status,
      count: parseInt(item.count, 10),
    }));
  }
}