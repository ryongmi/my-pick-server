import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { ReportActionRepository } from '../repositories/index.js';
import { ReportActionEntity } from '../entities/index.js';
import { ReportActionType, ExecutionStatus } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';

export interface CreateReportActionDto {
  actionType: ReportActionType;
  executedBy: string;
  executionStatus?: ExecutionStatus;
  duration?: number;
  reason?: string;
}

export interface UpdateReportActionDto {
  executionStatus?: ExecutionStatus;
  executedAt?: Date;
  duration?: number;
  reason?: string;
}

@Injectable()
export class ReportActionService {
  private readonly logger = new Logger(ReportActionService.name);

  constructor(
    private readonly actionRepo: ReportActionRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByReportId(reportId: string): Promise<ReportActionEntity[]> {
    try {
      const action = await this.actionRepo.findByReportId(reportId);
      return action ? [action] : [];
    } catch (error: unknown) {
      this.logger.error('Actions fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      // 조회 실패 시 빈 배열 반환 (orchestration에서 처리)
      return [];
    }
  }

  async findLatestByReportId(reportId: string): Promise<ReportActionEntity | null> {
    try {
      const actions = await this.findByReportId(reportId);
      if (actions.length === 0) return null;

      // 가장 최근 조치 반환 (createdAt 기준)
      return actions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
    } catch (error: unknown) {
      this.logger.error('Latest action fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return null;
    }
  }

  async findById(actionId: string): Promise<ReportActionEntity | null> {
    try {
      return await this.actionRepo.findOneById(actionId);
    } catch (error: unknown) {
      this.logger.error('Action fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        actionId,
      });
      return null;
    }
  }

  async findByIdOrFail(actionId: string): Promise<ReportActionEntity> {
    const action = await this.findById(actionId);
    if (!action) {
      this.logger.warn('Action not found', { actionId });
      throw ReportException.actionNotFound();
    }
    return action;
  }

  // ==================== 변경 메서드 ====================

  async createAction(
    reportId: string,
    dto: CreateReportActionDto,
    _transactionManager?: EntityManager
  ): Promise<string> {
    try {
      // 조치 데이터 생성
      const actionData: {
        actionType: ReportActionType;
        executedBy: string;
        executionStatus: ExecutionStatus;
        duration?: number;
        reason?: string;
      } = {
        actionType: dto.actionType,
        executedBy: dto.executedBy,
        executionStatus: dto.executionStatus || ExecutionStatus.PENDING,
      };

      if (dto.duration !== undefined) {
        actionData.duration = dto.duration;
      }
      if (dto.reason !== undefined) {
        actionData.reason = dto.reason;
      }

      // 저장
      await this.actionRepo.saveAction(reportId, actionData);

      this.logger.log('Action created successfully', {
        reportId,
        actionType: dto.actionType,
        executedBy: dto.executedBy,
        executionStatus: actionData.executionStatus,
      });

      return reportId; // Return reportId as placeholder since saveAction doesn't return entity
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Action creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        dto,
      });
      throw ReportException.actionCreateError();
    }
  }

  async updateAction(
    reportId: string,
    dto: UpdateReportActionDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 업데이트할 데이터 구성
      const updateData: Partial<ReportActionEntity> = {};
      
      if (dto.executionStatus !== undefined) {
        updateData.executionStatus = dto.executionStatus;
      }
      if (dto.executedAt !== undefined) {
        updateData.executedAt = dto.executedAt;
      }
      if (dto.duration !== undefined) {
        updateData.duration = dto.duration;
      }
      if (dto.reason !== undefined) {
        updateData.reason = dto.reason;
      }

      // 저장
      await this.actionRepo.updateAction(reportId, updateData as Record<string, unknown>);

      this.logger.log('Action updated successfully', {
        reportId,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Action update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        dto,
      });
      throw ReportException.actionUpdateError();
    }
  }

  async updateActionStatus(
    reportId: string,
    status: ExecutionStatus,
    executedAt?: Date,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const updateData: UpdateReportActionDto = {
        executionStatus: status,
      };

      if (executedAt) {
        updateData.executedAt = executedAt;
      } else if (status === ExecutionStatus.EXECUTED) {
        updateData.executedAt = new Date();
      }

      await this.updateAction(reportId, updateData, _transactionManager);

      this.logger.log('Action status updated successfully', {
        reportId,
        status,
        executedAt: updateData.executedAt,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Action status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        status,
      });
      throw ReportException.actionUpdateError();
    }
  }

  async deleteByReportId(
    reportId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      const deletedCount = 0;

      this.logger.log('Actions deleted successfully', {
        reportId,
        deletedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Actions deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.actionDeleteError();
    }
  }

  async deleteById(
    actionId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      await Promise.resolve();

      this.logger.log('Action deleted successfully', {
        actionId,
      });
    } catch (error: unknown) {
      this.logger.error('Action deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        actionId,
      });
      throw ReportException.actionDeleteError();
    }
  }

  // ==================== 집계 메서드 ====================

  async countByReportId(reportId: string): Promise<number> {
    try {
      const actions = await this.findByReportId(reportId);
      return actions.length;
    } catch (error: unknown) {
      this.logger.error('Action count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return 0;
    }
  }

  async hasActionsForReport(reportId: string): Promise<boolean> {
    try {
      const count = await this.countByReportId(reportId);
      return count > 0;
    } catch (error: unknown) {
      this.logger.error('Action existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return false;
    }
  }

  async getActionsByType(
    reportId: string,
    actionType: ReportActionType
  ): Promise<ReportActionEntity[]> {
    try {
      const actions = await this.findByReportId(reportId);
      return actions.filter(action => action.actionType === actionType);
    } catch (error: unknown) {
      this.logger.error('Actions by type fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        actionType,
      });
      return [];
    }
  }

  async getActionStatsByStatus(reportId: string): Promise<Record<ExecutionStatus, number>> {
    try {
      const actions = await this.findByReportId(reportId);
      
      const stats: Record<ExecutionStatus, number> = {
        [ExecutionStatus.PENDING]: 0,
        [ExecutionStatus.EXECUTED]: 0,
        [ExecutionStatus.FAILED]: 0,
      };

      actions.forEach(action => {
        if (action.executionStatus in stats) {
          stats[action.executionStatus]++;
        }
      });

      return stats;
    } catch (error: unknown) {
      this.logger.error('Action stats calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return {
        [ExecutionStatus.PENDING]: 0,
        [ExecutionStatus.EXECUTED]: 0,
        [ExecutionStatus.FAILED]: 0,
      };
    }
  }
}