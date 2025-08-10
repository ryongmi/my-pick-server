import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

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
import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';
import {
  CreateReportDto,
  ReportSearchQueryDto,
  ReviewReportDto,
  ReportDetailDto,
} from '../dto/index.js';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly evidenceRepo: ReportEvidenceRepository,
    private readonly reviewRepo: ReportReviewRepository,
    private readonly actionRepo: ReportActionRepository,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  async findById(reportId: string): Promise<ReportEntity | null> {
    try {
      return await this.reportRepo.findById(reportId);
    } catch (error: unknown) {
      this.logger.warn('Failed to find report by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return null;
    }
  }

  async findByIdOrFail(reportId: string): Promise<ReportEntity> {
    const report = await this.findById(reportId);

    if (!report) {
      this.logger.warn('Report not found', { reportId });
      throw ReportException.reportNotFound();
    }

    return report;
  }

  async searchReports(query: ReportSearchQueryDto): Promise<PaginatedResult<ReportDetailDto>> {
    try {
      this.logger.debug('Searching reports with query', {
        hasStatusFilter: !!query.status,
        hasTargetFilter: !!query.targetType,
        page: query.page || 1,
        limit: query.limit || 20,
      });

      const page = query.page || 1;
      const limit = (query.limit || 20) as LimitType;
      const offset = (page - 1) * limit;

      // 쿼리 조건 구성
      const whereConditions: Record<string, unknown> = {};

      if (query.status) whereConditions.status = query.status;
      if (query.targetType) whereConditions.targetType = query.targetType;
      if (query.targetId) whereConditions.targetId = query.targetId;
      if (query.reporterId) whereConditions.reporterId = query.reporterId;
      if (query.priority) whereConditions.priority = query.priority;

      // 정렬 조건
      const orderBy: Record<string, 'ASC' | 'DESC'> = {};
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'DESC';
      orderBy[sortBy] = sortOrder;

      // 데이터 조회
      const [reports, totalItems] = await this.reportRepo.findAndCount({
        where: whereConditions,
        order: orderBy,
        skip: offset,
        take: limit,
      });

      // 상세 정보 구성
      const detailedReports = await Promise.all(
        reports.map(async (report) => {
          return await this.buildReportDetail(report);
        })
      );

      const totalPages = Math.ceil(totalItems / limit);

      return {
        items: detailedReports,
        pageInfo: {
          totalItems,
          totalPages,
          page,
          limit,
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        },
      };
    } catch (error: unknown) {
      this.logger.error('Report search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      });
      throw ReportException.reportFetchError();
    }
  }

  async getReportById(reportId: string): Promise<ReportDetailDto> {
    try {
      const report = await this.findByIdOrFail(reportId);
      return await this.buildReportDetail(report);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to get report detail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.reportFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createReport(
    reporterId: string,
    dto: CreateReportDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      this.logger.log('Creating new report', {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      });

      // 자기 자신 신고 방지
      if (dto.targetType === ReportTargetType.USER && dto.targetId === reporterId) {
        throw ReportException.selfReportNotAllowed();
      }

      // 중복 신고 확인
      const existingReport = await this.reportRepo.findDuplicateReport(
        reporterId,
        dto.targetType,
        dto.targetId
      );

      if (existingReport) {
        this.logger.warn('Duplicate report attempt', {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          existingReportId: existingReport.id,
        });
        throw ReportException.duplicateReport();
      }

      // 신고 대상 존재 확인
      await this.validateReportTarget(dto.targetType, dto.targetId);

      // 우선순위 계산
      const priority = this.calculateReportPriority(dto.reason);

      // 신고 생성
      const reportData: Partial<ReportEntity> = {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        status: ReportStatus.PENDING,
        priority,
      };

      if (dto.description !== undefined) {
        reportData.description = dto.description;
      }

      const report = await this.reportRepo.createReport(reportData);

      // 증거 정보가 있다면 별도 엔티티로 저장
      if (
        dto.evidence &&
        (dto.evidence.screenshots || dto.evidence.urls || dto.evidence.additionalInfo)
      ) {
        await this.evidenceRepo.saveEvidence(report.id, dto.evidence);
      }

      this.logger.log('Report created successfully', {
        reportId: report.id,
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        priority,
        hasEvidence: !!dto.evidence,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Report creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      });
      throw ReportException.reportCreateError();
    }
  }

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

      const report = await this.findByIdOrFail(reportId);

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

  async deleteReport(reportId: string): Promise<void> {
    try {
      const report = await this.findByIdOrFail(reportId);

      // 검토 완료된 신고 삭제 방지
      if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
        throw ReportException.cannotDeleteReviewedReport();
      }

      // 관련 엔티티들도 함께 삭제
      await Promise.all([
        this.evidenceRepo.deleteByReportId(reportId),
        this.reviewRepo.deleteByReportId(reportId),
        this.actionRepo.deleteByReportId(reportId),
      ]);

      await this.reportRepo.deleteReport(reportId);

      this.logger.log('Report deleted successfully', { reportId });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Report deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
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
    try {
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
    } catch (error: unknown) {
      this.logger.error('Batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        limit,
      });
      return { processed: 0, failed: 0 };
    }
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.reportRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.warn('Failed to get total report count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async getReportStatistics(): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    reportsThisMonth: number;
    reportsByTargetType: Array<{ targetType: ReportTargetType; count: number }>;
    reportsByStatus: Array<{ status: ReportStatus; count: number }>;
    reportsByReason: Array<{ reason: ReportReason; count: number }>;
    reportTrends: Array<{ date: string; count: number }>;
  }> {
    try {
      const [
        totalReports,
        pendingReports,
        resolvedReports,
        reportsThisMonth,
        reportsByTargetType,
        reportsByStatus,
        reportsByReason,
        reportTrends,
      ] = await Promise.all([
        this.reportRepo.getTotalCount(),
        this.reportRepo.getCountByStatus(ReportStatus.PENDING),
        this.reportRepo.getCountByStatus(ReportStatus.RESOLVED),
        this.reportRepo.getReportsThisMonth(),
        this.reportRepo.getReportStatsByTargetType(),
        this.reportRepo.getReportStatsByStatus(),
        this.reportRepo.getReportStatsByReason(),
        this.reportRepo.getReportTrends(30),
      ]);

      return {
        totalReports,
        pendingReports,
        resolvedReports,
        reportsThisMonth,
        reportsByTargetType,
        reportsByStatus,
        reportsByReason,
        reportTrends,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to generate report statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ReportException.statisticsGenerationError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async buildReportDetail(report: ReportEntity): Promise<ReportDetailDto> {
    try {
      // 관련 엔티티 정보 조회
      const [evidence, review, action, reporterInfo, targetInfo] = await Promise.all([
        this.evidenceRepo.findByReportId(report.id),
        this.reviewRepo.findByReportId(report.id),
        this.actionRepo.findByReportId(report.id),
        this.getReporterInfo(report.reporterId),
        this.getTargetInfo(report.targetType, report.targetId),
      ]);

      const result: ReportDetailDto = {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      };

      // Handle optional properties conditionally
      if (report.description !== undefined) {
        result.description = report.description || '';
      }

      if (evidence) {
        const evidenceData: {
          screenshots?: string[];
          urls?: string[];
          additionalInfo?: Record<string, unknown>;
        } = {};
        if (evidence.screenshots !== undefined && evidence.screenshots !== null) {
          evidenceData.screenshots = evidence.screenshots;
        }
        if (evidence.urls !== undefined && evidence.urls !== null) {
          evidenceData.urls = evidence.urls;
        }
        if (evidence.additionalInfo !== undefined && evidence.additionalInfo !== null) {
          evidenceData.additionalInfo = evidence.additionalInfo;
        }
        result.evidence = evidenceData;
      }

      if (review?.reviewerId !== undefined) {
        result.reviewerId = review.reviewerId || '';
      }
      if (review?.reviewedAt !== undefined) {
        result.reviewedAt = review.reviewedAt || new Date();
      }
      if (review?.reviewComment !== undefined) {
        result.reviewComment = review.reviewComment || '';
      }

      if (action) {
        const actionData: {
          actionType: ReportActionType;
          duration?: number;
          reason?: string;
        } = {
          actionType: action.actionType as ReportActionType,
        };
        if (action.duration !== undefined && action.duration !== null) {
          actionData.duration = action.duration;
        }
        if (action.reason !== undefined && action.reason !== null) {
          actionData.reason = action.reason;
        }
        result.actions = actionData;
      }

      if (reporterInfo !== undefined) {
        result.reporterInfo = reporterInfo;
      }
      if (targetInfo !== undefined) {
        result.targetInfo = targetInfo;
      }

      return result;
    } catch (error: unknown) {
      this.logger.warn('Failed to build report detail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
      });

      // 최소한의 정보만 반환
      const basicDetail: ReportDetailDto = {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      };

      if (report.description !== undefined) {
        basicDetail.description = report.description || '';
      }

      return basicDetail;
    }
  }

  private async getReporterInfo(
    reporterId: string
  ): Promise<{ email: string; name?: string } | undefined> {
    try {
      const userInfo = await this.authClient
        .send('user.findById', { userId: reporterId })
        .toPromise();

      if (userInfo) {
        return {
          email: userInfo.email,
          name: userInfo.name,
        };
      }
    } catch (error: unknown) {
      this.logger.warn('Failed to get reporter info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reporterId,
      });
    }

    return undefined;
  }

  private async getTargetInfo(
    targetType: ReportTargetType,
    targetId: string
  ): Promise<{ title?: string; name?: string; type?: string } | undefined> {
    try {
      switch (targetType) {
        case ReportTargetType.USER: {
          const userInfo = await this.authClient
            .send('user.findById', { userId: targetId })
            .toPromise();
          return userInfo ? { name: userInfo.name || userInfo.email, type: 'user' } : undefined;
        }

        case ReportTargetType.CREATOR: {
          try {
            // Creator 서비스를 통해 크리에이터 정보 조회
            const creatorInfo = await this.authClient
              .send('creator.findById', { creatorId: targetId })
              .toPromise();
            return creatorInfo
              ? {
                  name: creatorInfo.displayName || creatorInfo.name,
                  type: 'creator',
                }
              : { name: `Creator ${targetId}`, type: 'creator' };
          } catch {
            return { name: `Creator ${targetId}`, type: 'creator' };
          }
        }

        case ReportTargetType.CONTENT: {
          try {
            // Content 서비스를 통해 콘텐츠 정보 조회
            const contentInfo = await this.authClient
              .send('content.findById', { contentId: targetId })
              .toPromise();
            return contentInfo
              ? {
                  title: contentInfo.title,
                  name: contentInfo.title,
                  type: 'content',
                }
              : { title: `Content ${targetId}`, type: 'content' };
          } catch {
            return { title: `Content ${targetId}`, type: 'content' };
          }
        }

        default:
          return undefined;
      }
    } catch (error: unknown) {
      this.logger.warn('Failed to get target info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
      });

      // 기본값 반환
      switch (targetType) {
        case ReportTargetType.CREATOR:
          return { name: `Creator ${targetId}`, type: 'creator' };
        case ReportTargetType.CONTENT:
          return { title: `Content ${targetId}`, type: 'content' };
        default:
          return undefined;
      }
    }
  }

  private async validateReportTarget(
    targetType: ReportTargetType,
    targetId: string
  ): Promise<void> {
    if (!targetId || targetId.trim().length === 0) {
      throw ReportException.invalidReportData();
    }

    try {
      switch (targetType) {
        case ReportTargetType.USER: {
          // Auth 서비스를 통해 사용자 존재 확인
          const userExists = await this.authClient
            .send('user.exists', { userId: targetId })
            .toPromise();
          if (!userExists) {
            this.logger.warn('Report target user not found', { targetId });
            throw ReportException.targetNotFound();
          }
          break;
        }

        case ReportTargetType.CREATOR: {
          // Creator 서비스를 통해 크리에이터 존재 확인
          try {
            const creatorExists = await this.authClient
              .send('creator.exists', { creatorId: targetId })
              .toPromise();
            if (!creatorExists) {
              this.logger.warn('Report target creator not found', { targetId });
              throw ReportException.targetNotFound();
            }
          } catch (error: unknown) {
            this.logger.warn('Failed to validate creator target, allowing report', {
              error: error instanceof Error ? error.message : 'Unknown error',
              targetId,
            });
            // 크리에이터 검증 실패 시에도 신고는 허용 (수동 검토를 위해)
          }
          break;
        }

        case ReportTargetType.CONTENT: {
          // Content 서비스를 통해 콘텐츠 존재 확인
          try {
            const contentExists = await this.authClient
              .send('content.exists', { contentId: targetId })
              .toPromise();
            if (!contentExists) {
              this.logger.warn('Report target content not found', { targetId });
              throw ReportException.targetNotFound();
            }
          } catch (error: unknown) {
            this.logger.warn('Failed to validate content target, allowing report', {
              error: error instanceof Error ? error.message : 'Unknown error',
              targetId,
            });
            // 콘텐츠 검증 실패 시에도 신고는 허용 (수동 검토를 위해)
          }
          break;
        }

        default:
          throw ReportException.invalidReportData();
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.warn('Failed to validate report target', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
      });

      // 검증 실패 시에도 신고는 허용 (관리자가 수동으로 검토할 수 있도록)
    }
  }

  private calculateReportPriority(reason: ReportReason): number {
    switch (reason) {
      case ReportReason.VIOLENCE:
      case ReportReason.HATE_SPEECH:
      case ReportReason.HARASSMENT:
        return 1; // 높음

      case ReportReason.INAPPROPRIATE_CONTENT:
      case ReportReason.COPYRIGHT_VIOLATION:
      case ReportReason.SCAM:
        return 2; // 보통

      default:
        return 3; // 낮음
    }
  }

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
