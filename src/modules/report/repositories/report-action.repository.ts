import { Injectable } from '@nestjs/common';

import { DataSource, Repository, MoreThan } from 'typeorm';

import { ReportActionEntity, ReportActionType } from '../entities/index.js';

@Injectable()
export class ReportActionRepository extends Repository<ReportActionEntity> {
  constructor(private dataSource: DataSource) {
    super(ReportActionEntity, dataSource.createEntityManager());
  }

  async findByReportId(reportId: string): Promise<ReportActionEntity | null> {
    return this.findOne({ where: { reportId } });
  }

  async saveAction(
    reportId: string,
    actionData: {
      actionType: ReportActionType;
      duration?: number;
      reason?: string;
      executedAt?: Date;
      executedBy?: string;
      executionStatus?: 'pending' | 'executed' | 'failed';
    }
  ): Promise<void> {
    const action = new ReportActionEntity();
    action.reportId = reportId;
    action.actionType = actionData.actionType;
    if (actionData.duration !== undefined) {
      action.duration = actionData.duration;
    }
    if (actionData.reason !== undefined) {
      action.reason = actionData.reason;
    }
    if (actionData.executedAt !== undefined) {
      action.executedAt = actionData.executedAt;
    }
    if (actionData.executedBy !== undefined) {
      action.executedBy = actionData.executedBy;
    }
    action.executionStatus = actionData.executionStatus || 'pending';

    await this.save(action);
  }

  async updateAction(
    reportId: string,
    actionData: Partial<{
      actionType: ReportActionType;
      duration: number;
      reason: string;
      executedAt: Date;
      executedBy: string;
      executionStatus: 'pending' | 'executed' | 'failed';
    }>
  ): Promise<void> {
    await this.update({ reportId }, actionData);
  }

  async findPendingActions(): Promise<ReportActionEntity[]> {
    return this.find({
      where: { executionStatus: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  async findActionsByType(
    actionType: ReportActionType,
    limit = 100
  ): Promise<ReportActionEntity[]> {
    return this.find({
      where: { actionType },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  async findActiveActions(): Promise<ReportActionEntity[]> {
    const now = new Date();

    return this.createQueryBuilder('action')
      .where('action.actionType IN (:...types)', {
        types: [ReportActionType.SUSPENSION, ReportActionType.BAN],
      })
      .andWhere('action.executionStatus = :status', { status: 'executed' })
      .andWhere(
        '(action.duration IS NULL OR DATE_ADD(action.executedAt, INTERVAL action.duration DAY) > :now)',
        { now }
      )
      .orderBy('action.executedAt', 'DESC')
      .getMany();
  }

  async getActionStatistics(): Promise<{
    totalActions: number;
    actionsByType: Array<{ actionType: ReportActionType; count: number }>;
    actionsByStatus: Array<{ status: string; count: number }>;
    actionsThisMonth: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalActions, actionsThisMonth, actionsByType, actionsByStatus] = await Promise.all([
      this.count(),
      this.count({
        where: { executedAt: MoreThan(startOfMonth) },
      }),
      this.createQueryBuilder('action')
        .select('action.actionType', 'actionType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('action.actionType')
        .getRawMany(),
      this.createQueryBuilder('action')
        .select('action.executionStatus', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('action.executionStatus')
        .getRawMany(),
    ]);

    return {
      totalActions,
      actionsByType: actionsByType.map((item) => ({
        actionType: item.actionType as ReportActionType,
        count: parseInt(item.count, 10),
      })),
      actionsByStatus: actionsByStatus.map((item) => ({
        status: item.status,
        count: parseInt(item.count, 10),
      })),
      actionsThisMonth,
    };
  }

  async deleteByReportId(reportId: string): Promise<void> {
    await this.delete({ reportId });
  }
}
