import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager } from 'typeorm';

import { CacheService } from '@database/redis/cache.service.js';

import {
  ReportRepository,
  ReportEvidenceRepository,
  ReportReviewRepository,
  ReportActionRepository,
} from '../repositories/index.js';
import {
  ReportEntity,
  ReportActionType,
} from '../entities/index.js';
import { ReportStatus, ReportTargetType } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';
import {
  ReviewReportDto,
} from '../dto/index.js';

@Injectable()
export class ReportReviewService {
  private readonly logger = new Logger(ReportReviewService.name);

  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly evidenceRepo: ReportEvidenceRepository,
    private readonly reviewRepo: ReportReviewRepository,
    private readonly actionRepo: ReportActionRepository,
    private readonly cacheService: CacheService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  async reviewReport(
    reportId: string,
    reviewerId: string,
    dto: ReviewReportDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      this.logger.log('Reviewing report', {
        reportId,
        reviewerId,
        newStatus: dto.status,
      });

      const report = await this.reportRepo.findById(reportId);
      if (!report) {
        throw ReportException.reportNotFound();
      }

      // 이미 검토된 신고 확인
      if (report.status !== ReportStatus.PENDING && report.status !== ReportStatus.UNDER_REVIEW) {
        throw ReportException.reportAlreadyReviewed();
      }

      // 상태 전환 유효성 검사
      this.validateStatusTransition(report.status, dto.status);

      // 신고 상태 업데이트
      await this.reportRepo.updateReport(reportId, { status: dto.status });

      // 검토 정보 저장
      const reviewData: {
        reviewerId: string;
        reviewedAt: Date;
        reviewComment?: string;
      } = {
        reviewerId,
        reviewedAt: new Date(),
      };

      if (dto.reviewComment !== undefined) {
        reviewData.reviewComment = dto.reviewComment;
      }

      await this.reviewRepo.saveReview(reportId, reviewData);

      // 조치 정보가 있다면 저장
      if (dto.actions) {
        const actionData: {
          actionType: ReportActionType;
          executedBy: string;
          executionStatus: 'pending' | 'executed' | 'failed';
          duration?: number;
          reason?: string;
        } = {
          actionType: (dto.actions.actionType as ReportActionType) || ReportActionType.NONE,
          executedBy: reviewerId,
          executionStatus: 'pending',
        };

        if (dto.actions.duration !== undefined) {
          actionData.duration = dto.actions.duration;
        }
        if (dto.actions.reason !== undefined) {
          actionData.reason = dto.actions.reason;
        }

        await this.actionRepo.saveAction(reportId, actionData);

        // 조치 실행
        if (dto.actions.actionType && dto.actions.actionType !== 'none') {
          await this.executeReportAction(report, dto.actions);
        }
      }

      // 신고 관련 캐시 무효화 (상태 변경으로 인한 통계 업데이트)
      await this.cacheService.invalidateReportRelatedCaches();

      this.logger.log('Report reviewed successfully', {
        reportId,
        reviewerId,
        newStatus: dto.status,
        actionType: dto.actions?.actionType,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Report review failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        reviewerId,
      });
      throw ReportException.reportUpdateError();
    }
  }

  // ==================== 배치 처리 메서드 ====================

  async batchUpdateReportStatus(reportIds: string[], status: ReportStatus): Promise<void> {
    try {
      this.logger.log('Batch updating report status', {
        reportCount: reportIds.length,
        newStatus: status,
      });

      await Promise.all(
        reportIds.map((reportId) => this.reportRepo.updateReport(reportId, { status }))
      );

      this.logger.log('Batch status update completed', {
        reportCount: reportIds.length,
        newStatus: status,
      });
    } catch (error: unknown) {
      this.logger.error('Batch status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportCount: reportIds.length,
        newStatus: status,
      });
      throw ReportException.reportUpdateError();
    }
  }

  async batchProcessPendingReports(limit = 50): Promise<{
    processed: number;
    failed: number;
  }> {
    return await this.executeWithErrorHandling(
      async () => {
        const pendingReports = await this.reportRepo.findPendingReports(limit);

        let processed = 0;
        let failed = 0;

        for (const report of pendingReports) {
          try {
            // 자동 처리 로직 (단순한 규칙 기반)
            if (await this.shouldAutoResolve(report)) {
              await this.reportRepo.updateReport(report.id, {
                status: ReportStatus.DISMISSED,
              });
              processed++;
            }
          } catch (error: unknown) {
            this.logger.warn('Failed to auto-process report', {
              error: error instanceof Error ? error.message : 'Unknown error',
              reportId: report.id,
            });
            failed++;
          }
        }

        this.logger.log('Batch processing completed', {
          totalReports: pendingReports.length,
          processed,
          failed,
        });

        return { processed, failed };
      },
      'Batch process pending reports',
      { limit },
      { processed: 0, failed: 0 }
    );
  }

  // ==================== 에러 처리 헬퍼 메서드 ====================

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {},
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      if (fallbackValue !== undefined) {
        this.logger.warn(`Using fallback value for ${operationName}`, {
          fallbackValue,
          ...context,
        });
        return fallbackValue;
      }

      throw ReportException.reportUpdateError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private validateStatusTransition(currentStatus: ReportStatus, newStatus: ReportStatus): void {
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      [ReportStatus.PENDING]: [ReportStatus.UNDER_REVIEW, ReportStatus.DISMISSED],
      [ReportStatus.UNDER_REVIEW]: [
        ReportStatus.RESOLVED,
        ReportStatus.REJECTED,
        ReportStatus.DISMISSED,
      ],
      [ReportStatus.RESOLVED]: [],
      [ReportStatus.REJECTED]: [],
      [ReportStatus.DISMISSED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw ReportException.invalidStatusTransition();
    }
  }

  private async executeReportAction(
    report: ReportEntity,
    actions: { actionType?: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      // actionType이 없으면 아무 작업도 하지 않음
      if (!actions.actionType) {
        this.logger.debug('No action type specified, skipping action execution', {
          reportId: report.id,
        });
        return;
      }

      this.logger.log('Executing report action', {
        reportId: report.id,
        actionType: actions.actionType,
        duration: actions.duration,
        targetType: report.targetType,
        targetId: report.targetId,
      });

      // 이제 actionType이 존재함을 TypeScript가 알 수 있음
      const confirmedActions = actions as {
        actionType: string;
        duration?: number;
        reason?: string;
      };

      switch (confirmedActions.actionType) {
        case ReportActionType.WARNING:
          await this.executeWarningAction(report, confirmedActions);
          break;

        case ReportActionType.SUSPENSION:
          await this.executeSuspensionAction(report, confirmedActions);
          break;

        case ReportActionType.BAN:
          await this.executeBanAction(report, confirmedActions);
          break;

        case ReportActionType.CONTENT_REMOVAL:
          await this.executeContentRemovalAction(report, confirmedActions);
          break;

        case ReportActionType.NONE:
        default:
          this.logger.debug('No action required', { reportId: report.id });
          break;
      }

      // 조치 실행 상태 업데이트
      await this.actionRepo.updateAction(report.id, {
        executedAt: new Date(),
        executionStatus: 'executed',
      });

      this.logger.log('Report action executed successfully', {
        reportId: report.id,
        actionType: actions.actionType,
        targetType: report.targetType,
        targetId: report.targetId,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to execute report action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        actionType: actions.actionType,
        targetType: report.targetType,
        targetId: report.targetId,
      });

      // 조치 실행 실패 상태 업데이트
      await this.actionRepo.updateAction(report.id, {
        executionStatus: 'failed',
      });
    }
  }

  private async executeWarningAction(
    report: ReportEntity,
    actions: { actionType: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      if (report.targetType === ReportTargetType.USER) {
        // Auth 서비스에 경고 요청 전송
        await this.authClient
          .send('user.sendWarning', {
            userId: report.targetId,
            reason: actions.reason || '신고로 인한 경고',
            reportId: report.id,
          })
          .toPromise();

        this.logger.log('Warning sent to user', {
          reportId: report.id,
          targetId: report.targetId,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to execute warning action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        targetId: report.targetId,
      });
      throw error;
    }
  }

  private async executeSuspensionAction(
    report: ReportEntity,
    actions: { actionType: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      if (report.targetType === ReportTargetType.USER) {
        // Auth 서비스에 정지 요청 전송
        await this.authClient
          .send('user.suspend', {
            userId: report.targetId,
            duration: actions.duration || 7, // 기본 7일
            reason: actions.reason || '신고로 인한 계정 정지',
            reportId: report.id,
          })
          .toPromise();

        this.logger.log('User suspended', {
          reportId: report.id,
          targetId: report.targetId,
          duration: actions.duration || 7,
        });
      } else if (report.targetType === ReportTargetType.CREATOR) {
        // Creator 서비스에 정지 요청 전송
        await this.authClient
          .send('creator.suspend', {
            creatorId: report.targetId,
            duration: actions.duration || 7,
            reason: actions.reason || '신고로 인한 크리에이터 정지',
            reportId: report.id,
          })
          .toPromise();

        this.logger.log('Creator suspended', {
          reportId: report.id,
          targetId: report.targetId,
          duration: actions.duration || 7,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to execute suspension action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        targetId: report.targetId,
        duration: actions.duration,
      });
      throw error;
    }
  }

  private async executeBanAction(
    report: ReportEntity,
    actions: { actionType: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      if (report.targetType === ReportTargetType.USER) {
        // Auth 서비스에 차단 요청 전송
        await this.authClient
          .send('user.ban', {
            userId: report.targetId,
            reason: actions.reason || '신고로 인한 계정 차단',
            reportId: report.id,
            permanent: !actions.duration, // duration이 없으면 영구 차단
            duration: actions.duration,
          })
          .toPromise();

        this.logger.log('User banned', {
          reportId: report.id,
          targetId: report.targetId,
          permanent: !actions.duration,
          duration: actions.duration,
        });
      } else if (report.targetType === ReportTargetType.CREATOR) {
        // Creator 서비스에 차단 요청 전송
        await this.authClient
          .send('creator.ban', {
            creatorId: report.targetId,
            reason: actions.reason || '신고로 인한 크리에이터 차단',
            reportId: report.id,
            permanent: !actions.duration,
            duration: actions.duration,
          })
          .toPromise();

        this.logger.log('Creator banned', {
          reportId: report.id,
          targetId: report.targetId,
          permanent: !actions.duration,
          duration: actions.duration,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to execute ban action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        targetId: report.targetId,
        duration: actions.duration,
      });
      throw error;
    }
  }

  private async executeContentRemovalAction(
    report: ReportEntity,
    actions: { actionType: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      if (report.targetType === ReportTargetType.CONTENT) {
        // Content 서비스에 삭제 요청 전송
        await this.authClient
          .send('content.remove', {
            contentId: report.targetId,
            reason: actions.reason || '신고로 인한 콘텐츠 삭제',
            reportId: report.id,
          })
          .toPromise();

        this.logger.log('Content removed', {
          reportId: report.id,
          targetId: report.targetId,
        });
      }
    } catch (error: unknown) {
      this.logger.error('Failed to execute content removal action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        targetId: report.targetId,
      });
      throw error;
    }
  }

  private async shouldAutoResolve(report: ReportEntity): Promise<boolean> {
    // 간단한 자동 해결 규칙
    // 1. 낮은 우선순위이고 오래된 신고
    // 2. 동일 대상에 대한 신고가 적은 경우
    if (report.priority === 3) {
      const daysSinceCreated = (Date.now() - report.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated > 7) {
        const relatedReports = await this.reportRepo.getCountByTarget(
          report.targetType,
          report.targetId
        );
        return relatedReports <= 2;
      }
    }

    return false;
  }
}