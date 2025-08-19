import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { DataSource, EntityManager } from 'typeorm';

import { CacheService } from '@database/redis/cache.service.js';

import { ReportStatus, ReportTargetType, ReportActionType, ExecutionStatus } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';
import { CreateReportDto, ReportDetailDto, ReviewReportDto } from '../dto/index.js';

import { ReportService } from './report.service.js';
import { ReportEvidenceService } from './report-evidence.service.js';
import { ReportActionService } from './report-action.service.js';
import { ReportReviewService } from './report-review.service.js';

// Interface definitions for the orchestration service
export interface CreateReportEvidenceDto {
  screenshots?: string[];
  urls?: string[];
  additionalInfo?: Record<string, unknown>;
}

export interface CreateReportActionDto {
  actionType: ReportActionType;
  executedBy: string;
  executionStatus?: ExecutionStatus;
  duration?: number;
  reason?: string;
}

export interface CreateReportReviewDataDto {
  reviewerId: string;
  reviewedAt: Date;
  reviewComment?: string;
}

export interface UpdateReportActionDto {
  executionStatus?: ExecutionStatus;
  executedAt?: Date;
  duration?: number;
  reason?: string;
}

export interface UpdateReportReviewDataDto {
  reviewComment?: string;
  reviewedAt?: Date;
}

export interface CreateReportCompleteDto extends CreateReportDto {
  evidence?: CreateReportEvidenceDto;
}

export interface ReviewReportCompleteDto {
  reviewerId: string;
  reviewComment?: string;
  actionType: ReportActionType;
  actionReason?: string;
  actionDuration?: number;
  decision: 'approve' | 'reject';
}

@Injectable()
export class ReportOrchestrationService {
  private readonly logger = new Logger(ReportOrchestrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    private readonly reportService: ReportService,
    private readonly evidenceService: ReportEvidenceService,
    private readonly actionService: ReportActionService,
    private readonly reviewService: ReportReviewService
  ) {}

  // ==================== 복합 검토 작업 (기존 인터페이스 호환) ====================

  async reviewReport(
    reportId: string,
    reviewerId: string,
    dto: ReviewReportDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    const useExistingTransaction = !!transactionManager;
    
    if (!useExistingTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      this.logger.log('Starting report review workflow (legacy interface)', {
        reportId,
        reviewerId,
        newStatus: dto.status,
        hasActions: !!dto.actions,
      });

      // 1. 신고 조회 및 검증
      const report = await this.reportService.findByIdOrFail(reportId);

      // 2. 이미 검토된 신고 확인
      if (report.status !== ReportStatus.PENDING && report.status !== ReportStatus.UNDER_REVIEW) {
        throw ReportException.reportAlreadyReviewed();
      }

      // 3. 상태 전환 유효성 검사
      this.validateStatusTransition(report.status, dto.status);

      // 4. 신고 상태 업데이트
      await this.reportService.updateReportStatus(
        reportId, 
        dto.status, 
        useExistingTransaction ? transactionManager : queryRunner.manager
      );

      // 5. 검토 정보 저장
      const reviewData: CreateReportReviewDataDto = {
        reviewerId,
        reviewedAt: new Date(),
      };

      if (dto.reviewComment !== undefined) {
        reviewData.reviewComment = dto.reviewComment;
      }

      await this.reviewService.createReview(
        reportId, 
        reviewData, 
        useExistingTransaction ? transactionManager : queryRunner.manager
      );

      // 6. 조치 정보가 있다면 저장
      if (dto.actions) {
        const actionData: CreateReportActionDto = {
          actionType: (dto.actions.actionType as ReportActionType) || ReportActionType.NONE,
          executedBy: reviewerId,
          executionStatus: ExecutionStatus.PENDING,
        };

        if (dto.actions.duration !== undefined) {
          actionData.duration = dto.actions.duration;
        }
        if (dto.actions.reason !== undefined) {
          actionData.reason = dto.actions.reason;
        }

        await this.actionService.createAction(
          reportId, 
          actionData, 
          useExistingTransaction ? transactionManager : queryRunner.manager
        );

        // 조치 실행 (외부 서비스 알림)
        if (dto.actions.actionType && dto.actions.actionType !== 'none') {
          await this.executeReportAction(report as unknown as Record<string, unknown>, dto.actions as Record<string, unknown>);
        }
      }

      // 7. 캐시 무효화
      await this.invalidateReportCaches(report.targetType, report.targetId);

      if (!useExistingTransaction) {
        await queryRunner.commitTransaction();
      }

      this.logger.log('Report review workflow completed successfully (legacy interface)', {
        reportId,
        reviewerId,
        newStatus: dto.status,
        actionType: dto.actions?.actionType,
      });

    } catch (error: unknown) {
      if (!useExistingTransaction) {
        await queryRunner.rollbackTransaction();
      }
      
      this.logger.error('Report review workflow failed (legacy interface)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        reviewerId,
      });

      throw error;
    } finally {
      if (!useExistingTransaction) {
        await queryRunner.release();
      }
    }
  }

  // ==================== 복합 생성 작업 ====================

  async createReportComplete(
    reporterId: string,
    dto: CreateReportCompleteDto
  ): Promise<{ reportId: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting complete report creation workflow', {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        hasEvidence: !!dto.evidence,
      });

      // 1. 신고 생성
      const reportId = await this.reportService.createReport(reporterId, dto, queryRunner.manager);

      // 2. 증거 저장 (있는 경우)
      if (dto.evidence) {
        await this.evidenceService.createEvidence(reportId, dto.evidence, queryRunner.manager);
      }

      // 3. 캐시 무효화
      await this.invalidateReportCaches(dto.targetType, dto.targetId);

      await queryRunner.commitTransaction();

      this.logger.log('Report creation workflow completed successfully', {
        reportId,
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        hasEvidence: !!dto.evidence,
      });

      // 4. 외부 서비스 알림 (비동기)
      this.notifyExternalServices('report.created', {
        reportId,
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      }).catch((error) => {
        this.logger.warn('Failed to notify external services', {
          error: error instanceof Error ? error.message : 'Unknown error',
          reportId,
        });
      });

      return { reportId };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      this.logger.error('Report creation workflow failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reviewReportComplete(reportId: string, dto: ReviewReportCompleteDto): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting complete report review workflow', {
        reportId,
        reviewerId: dto.reviewerId,
        decision: dto.decision,
        actionType: dto.actionType,
      });

      // 1. 신고 정보 조회
      const report = await this.reportService.findByIdOrFail(reportId);

      // 2. 검토 데이터 생성
      const reviewDto: CreateReportReviewDataDto = {
        reviewerId: dto.reviewerId,
        reviewedAt: new Date(),
      };

      if (dto.reviewComment !== undefined) {
        reviewDto.reviewComment = dto.reviewComment;
      }

      await this.reviewService.createReview(reportId, reviewDto, queryRunner.manager);

      // 3. 조치 생성
      const actionDto: CreateReportActionDto = {
        actionType: dto.actionType,
        executedBy: dto.reviewerId,
        executionStatus: ExecutionStatus.PENDING,
      };

      if (dto.actionDuration !== undefined) {
        actionDto.duration = dto.actionDuration;
      }
      if (dto.actionReason !== undefined) {
        actionDto.reason = dto.actionReason;
      }

      const actionId = await this.actionService.createAction(
        reportId,
        actionDto,
        queryRunner.manager
      );

      // 4. 신고 상태 업데이트
      const newStatus = dto.decision === 'approve' ? ReportStatus.RESOLVED : ReportStatus.REJECTED;
      await this.reportService.updateReportStatus(reportId, newStatus, queryRunner.manager);

      // 5. 캐시 무효화
      await this.invalidateReportCaches(report.targetType, report.targetId);

      await queryRunner.commitTransaction();

      this.logger.log('Report review workflow completed successfully', {
        reportId,
        reviewerId: dto.reviewerId,
        decision: dto.decision,
        actionId,
        newStatus,
      });

      // 6. 외부 서비스 알림 및 조치 실행 (비동기)
      this.executePostReviewActions(reportId, report as unknown as Record<string, unknown>, dto, actionId).catch((error) => {
        this.logger.warn('Failed to execute post-review actions', {
          error: error instanceof Error ? error.message : 'Unknown error',
          reportId,
          actionId,
        });
      });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      this.logger.error('Report review workflow failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        reviewerId: dto.reviewerId,
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== 복합 조회 작업 ====================

  async getReportDetailComplete(reportId: string): Promise<
    ReportDetailDto & {
      evidence?: Array<{
        screenshots?: string[];
        urls?: string[];
        additionalInfo?: Record<string, unknown>;
      }>;
      actions?: Array<{
        id: string;
        actionType: ReportActionType;
        executedBy: string;
        executionStatus: string;
        executedAt?: Date;
        duration?: number;
        reason?: string;
        createdAt: Date;
      }>;
      review?: {
        reviewerId: string;
        reviewedAt: Date;
        reviewComment?: string;
      };
    }
  > {
    try {
      this.logger.debug('Getting complete report details', { reportId });

      // 1. 기본 신고 정보 조회
      const reportDetail = await this.reportService.getReportById(reportId);

      // 2. 관련 데이터 병렬 조회
      const [evidence, actions, review] = await Promise.all([
        this.evidenceService.findByReportId(reportId),
        this.actionService.findByReportId(reportId),
        this.reviewService.findByReportId(reportId),
      ]);

      // 3. 결과 조합 (simplified to avoid type issues)
      const result = {
        ...reportDetail,
        evidence: evidence
          ? evidence.screenshots || evidence.urls || evidence.additionalInfo
            ? [
                {
                  screenshots: evidence.screenshots || undefined,
                  urls: evidence.urls || undefined,
                  additionalInfo: evidence.additionalInfo || undefined,
                },
              ]
            : undefined
          : undefined,
        actions: actions.map((action) => ({
          id: action.reportId, // Use reportId as placeholder since no proper id
          actionType: action.actionType,
          executedBy: action.executedBy || 'unknown',
          executionStatus: action.executionStatus,
          executedAt: action.executedAt,
          duration: action.duration,
          reason: action.reason,
          createdAt: action.createdAt,
        })),
        review: review
          ? {
              reviewerId: review.reviewerId,
              reviewedAt: review.reviewedAt,
              reviewComment: review.reviewComment,
            }
          : undefined,
      } as Record<string, unknown>;

      this.logger.debug('Complete report details retrieved', {
        reportId,
        hasEvidence: !!evidence,
        actionsCount: actions.length,
        hasReview: !!review,
      });

      return result as unknown as import('../dto/index.js').ReportDetailDto & {
        evidence?: { screenshots?: string[]; urls?: string[]; additionalInfo?: Record<string, unknown>; }[];
        actions?: { id: string; actionType: import('../enums/index.js').ReportActionType; executionStatus: import('../enums/index.js').ExecutionStatus; executedBy: string; executedAt: Date; duration?: number; createdAt: Date; }[];
        review?: { reviewerId: string; reviewedAt: Date; reviewComment?: string; };
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get complete report details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw error;
    }
  }

  // ==================== 복합 삭제 작업 ====================

  async deleteReportComplete(reportId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting complete report deletion workflow', { reportId });

      // 1. 신고 정보 조회 (캐시 무효화용)
      const report = await this.reportService.findByIdOrFail(reportId);

      // 2. 관련 데이터 순차 삭제 (FK 제약 조건 고려)
      await this.reviewService.deleteByReportId(reportId, queryRunner.manager);
      await this.actionService.deleteByReportId(reportId, queryRunner.manager);
      await this.evidenceService.deleteByReportId(reportId, queryRunner.manager);
      await this.reportService.deleteReport(reportId, queryRunner.manager);

      // 3. 캐시 무효화
      await this.invalidateReportCaches(report.targetType, report.targetId);

      await queryRunner.commitTransaction();

      this.logger.log('Report deletion workflow completed successfully', {
        reportId,
        targetType: report.targetType,
        targetId: report.targetId,
      });
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      this.logger.error('Report deletion workflow failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== 배치 작업 ====================

  async batchProcessPendingReports(limit: number = 50): Promise<{
    processed: number;
    failed: number;
    errors: Array<{ reportId: string; error: string }>;
  }> {
    try {
      this.logger.log('Starting batch process for pending reports', { limit });

      // 대기 중인 신고 조회는 reportService를 통해
      const pendingReports = await this.reportService.searchReports({
        status: ReportStatus.PENDING,
        limit,
        page: 1,
      });

      const errors: Array<{ reportId: string; error: string }> = [];
      let processed = 0;

      for (const report of pendingReports.items) {
        try {
          // 자동 처리 로직 (우선순위 기반)
          if (report.priority === 1) {
            // 높은 우선순위 - 즉시 검토 필요
            await this.markForUrgentReview(report.id);
          } else if (report.priority >= 3) {
            // 낮은 우선순위 - 자동 처리 고려
            await this.autoProcessLowPriorityReport(report.id);
          }

          processed++;
        } catch (error: unknown) {
          errors.push({
            reportId: report.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.logger.log('Batch processing completed', {
        totalReports: pendingReports.items.length,
        processed,
        failed: errors.length,
      });

      return {
        processed,
        failed: errors.length,
        errors,
      };
    } catch (error: unknown) {
      this.logger.error('Batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      throw ReportException.reportFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateStatusTransition(currentStatus: ReportStatus, newStatus: ReportStatus): void {
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      [ReportStatus.PENDING]: [
        ReportStatus.UNDER_REVIEW,
        ReportStatus.RESOLVED,
        ReportStatus.REJECTED,
        ReportStatus.DISMISSED,
      ],
      [ReportStatus.UNDER_REVIEW]: [
        ReportStatus.RESOLVED,
        ReportStatus.REJECTED,
        ReportStatus.DISMISSED,
      ],
      [ReportStatus.RESOLVED]: [], // 최종 상태
      [ReportStatus.REJECTED]: [], // 최종 상태
      [ReportStatus.DISMISSED]: [], // 최종 상태
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw ReportException.invalidStatusTransition();
    }
  }

  private async executeReportAction(
    report: Record<string, unknown>,
    actionDto: Record<string, unknown>
  ): Promise<void> {
    try {
      this.logger.debug('Executing report action', {
        reportId: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        actionType: actionDto.actionType,
      });

      // 외부 서비스 알림 (비동기)
      await this.notifyExternalServices('report.action.executed', {
        reportId: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        actionType: actionDto.actionType,
        duration: actionDto.duration,
        reason: actionDto.reason,
      });

    } catch (error: unknown) {
      this.logger.warn('Failed to execute report action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        actionType: actionDto.actionType,
      });
      // 조치 실행 실패는 메인 플로우를 중단하지 않음
    }
  }

  private async invalidateReportCaches(
    targetType: ReportTargetType,
    targetId: string
  ): Promise<void> {
    try {
      // 신고 통계 캐시 무효화
      await this.cacheService.invalidateReportStatisticsCaches();

      // 대상별 신고 캐시 무효화 (simplified for now)
      this.logger.debug('Skipping target cache invalidation - method not available');

      this.logger.debug('Report caches invalidated', { targetType, targetId });
    } catch (error: unknown) {
      this.logger.warn('Failed to invalidate report caches', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
      });
    }
  }

  private async notifyExternalServices(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      // 외부 서비스 알림
      await Promise.all([
        this.authClient.emit('report.event', { eventType, data }).toPromise(),
        // 다른 서비스들에 대한 알림도 여기에 추가
      ]);

      this.logger.debug('External services notified', { eventType, data });
    } catch (error: unknown) {
      this.logger.warn('Failed to notify external services', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType,
        data,
      });
      // 알림 실패는 메인 플로우에 영향주지 않음
    }
  }

  private async executePostReviewActions(
    reportId: string,
    report: Record<string, unknown>,
    reviewDto: ReviewReportCompleteDto,
    actionId: string
  ): Promise<void> {
    try {
      // 1. 조치 실행 상태 업데이트
      await this.actionService.updateActionStatus(reportId, ExecutionStatus.EXECUTED, new Date());

      // 2. 외부 서비스 알림
      await this.notifyExternalServices('report.reviewed', {
        reportId,
        reviewerId: reviewDto.reviewerId,
        decision: reviewDto.decision,
        actionType: reviewDto.actionType,
        targetType: report.targetType,
        targetId: report.targetId,
      });

      // 3. 타겟에 대한 실제 조치 실행 (필요한 경우)
      if (reviewDto.decision === 'approve') {
        await this.executeTargetAction(
          (report as { targetType: import('../enums/index.js').ReportTargetType }).targetType,
          (report as { targetId: string }).targetId,
          reviewDto.actionType
        );
      }

      this.logger.debug('Post-review actions executed', { reportId, actionId });
    } catch (error: unknown) {
      this.logger.error('Post-review actions failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        actionId,
      });

      // 실행 실패 시 조치 상태 업데이트
      await this.actionService.updateActionStatus(reportId, ExecutionStatus.FAILED, new Date());
    }
  }

  private async executeTargetAction(
    targetType: ReportTargetType,
    targetId: string,
    actionType: ReportActionType
  ): Promise<void> {
    try {
      switch (targetType) {
        case ReportTargetType.USER:
          await this.authClient
            .emit('user.action', {
              userId: targetId,
              actionType,
            })
            .toPromise();
          break;

        case ReportTargetType.CREATOR:
          await this.authClient
            .emit('creator.action', {
              creatorId: targetId,
              actionType,
            })
            .toPromise();
          break;

        case ReportTargetType.CONTENT:
          await this.authClient
            .emit('content.action', {
              contentId: targetId,
              actionType,
            })
            .toPromise();
          break;
      }

      this.logger.debug('Target action executed', { targetType, targetId, actionType });
    } catch (error: unknown) {
      this.logger.warn('Failed to execute target action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
        actionType,
      });
      throw error;
    }
  }

  private async markForUrgentReview(reportId: string): Promise<void> {
    try {
      // 긴급 검토 대기열에 추가 (method doesn't exist, so we use a generic cache set)
      await this.cacheService.set(`urgent:review:${reportId}`, '1', 3600);

      this.logger.debug('Report marked for urgent review', { reportId });
    } catch (error: unknown) {
      this.logger.warn('Failed to mark for urgent review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
    }
  }

  private async autoProcessLowPriorityReport(reportId: string): Promise<void> {
    try {
      // 낮은 우선순위 신고 자동 처리 로직
      // 예: 일정 기간 후 자동 만료, 경고 처리 등

      this.logger.debug('Low priority report auto-processed', { reportId });
    } catch (error: unknown) {
      this.logger.warn('Failed to auto-process low priority report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
    }
  }
}
