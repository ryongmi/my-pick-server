import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EntityManager } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';
import { plainToInstance } from 'class-transformer';

import { ReportRepository } from '../repositories/index.js';
import { ReportEntity } from '../entities/index.js';
import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';

// 임시 DTO 타입 정의 (나중에 dto 폴더로 이동)
export interface CreateReportDto {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
  evidence?: {
    screenshots?: string[];
    urls?: string[];
    additionalInfo?: Record<string, unknown>;
  };
}

export interface ReportSearchQueryDto {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  targetType?: ReportTargetType;
  targetId?: string;
  reporterId?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ReviewReportDto {
  status: ReportStatus;
  reviewComment?: string;
  actions?: {
    actionType?: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'none';
    duration?: number;
    reason?: string;
  };
}

export interface ReportDetailDto {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
  evidence?: {
    screenshots?: string[];
    urls?: string[];
    additionalInfo?: Record<string, unknown>;
  };
  status: ReportStatus;
  reviewerId?: string;
  reviewedAt?: Date;
  reviewComment?: string;
  actions?: {
    actionType?: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'none';
    duration?: number;
    reason?: string;
  };
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  // 관련 엔티티 정보
  reporterInfo?: {
    email: string;
    name?: string;
  };
  targetInfo?: {
    title?: string;
    name?: string;
    type?: string;
  };
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly reportRepo: ReportRepository,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
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
      const whereConditions: any = {};
      
      if (query.status) {
        whereConditions.status = query.status;
      }
      
      if (query.targetType) {
        whereConditions.targetType = query.targetType;
      }
      
      if (query.targetId) {
        whereConditions.targetId = query.targetId;
      }
      
      if (query.reporterId) {
        whereConditions.reporterId = query.reporterId;
      }
      
      if (query.priority) {
        whereConditions.priority = query.priority;
      }

      // 날짜 범위 필터
      if (query.startDate || query.endDate) {
        // 날짜 범위 처리는 repository에서 구현
      }

      // 정렬 조건
      const orderBy: any = {};
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
      if (error instanceof ReportException) {
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
    transactionManager?: EntityManager
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
        description: dto.description,
        evidence: dto.evidence,
        status: ReportStatus.PENDING,
        priority,
      };

      await this.reportRepo.create(reportData);

      this.logger.log('Report created successfully', {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        priority,
      });
    } catch (error: unknown) {
      if (error instanceof ReportException) {
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
    transactionManager?: EntityManager
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

      // 신고 업데이트
      const updateData: Partial<ReportEntity> = {
        status: dto.status,
        reviewerId,
        reviewedAt: new Date(),
        reviewComment: dto.reviewComment,
        actions: dto.actions,
      };

      await this.reportRepo.update(reportId, updateData);

      // 조치 실행
      if (dto.actions && dto.actions.actionType !== 'none') {
        await this.executeReportAction(report, dto.actions);
      }

      this.logger.log('Report reviewed successfully', {
        reportId,
        reviewerId,
        newStatus: dto.status,
        actionType: dto.actions?.actionType,
      });
    } catch (error: unknown) {
      if (error instanceof ReportException) {
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

      await this.reportRepo.delete(reportId);

      this.logger.log('Report deleted successfully', { reportId });
    } catch (error: unknown) {
      if (error instanceof ReportException) {
        throw error;
      }

      this.logger.error('Report deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.reportUpdateError();
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
    reportsByTargetType: Array<{ targetType: ReportTargetType; count: number }>;
    reportsByStatus: Array<{ status: ReportStatus; count: number }>;
  }> {
    try {
      const [
        totalReports,
        pendingReports,
        resolvedReports,
        reportsByTargetType,
        reportsByStatus,
      ] = await Promise.all([
        this.reportRepo.getTotalCount(),
        this.reportRepo.getCountByStatus(ReportStatus.PENDING),
        this.reportRepo.getCountByStatus(ReportStatus.RESOLVED),
        this.reportRepo.getReportStatsByTargetType(),
        this.reportRepo.getReportStatsByStatus(),
      ]);

      return {
        totalReports,
        pendingReports,
        resolvedReports,
        reportsByTargetType,
        reportsByStatus,
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
      // 신고자 정보 조회
      const reporterInfo = await this.getReporterInfo(report.reporterId);
      
      // 신고 대상 정보 조회
      const targetInfo = await this.getTargetInfo(report.targetType, report.targetId);

      return {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        description: report.description,
        evidence: report.evidence,
        status: report.status,
        reviewerId: report.reviewerId,
        reviewedAt: report.reviewedAt,
        reviewComment: report.reviewComment,
        actions: report.actions,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        reporterInfo,
        targetInfo,
      };
    } catch (error: unknown) {
      this.logger.warn('Failed to build report detail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
      });

      // 최소한의 정보만 반환
      return {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        description: report.description,
        evidence: report.evidence,
        status: report.status,
        reviewerId: report.reviewerId,
        reviewedAt: report.reviewedAt,
        reviewComment: report.reviewComment,
        actions: report.actions,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      };
    }
  }

  private async getReporterInfo(reporterId: string): Promise<{ email: string; name?: string } | undefined> {
    try {
      const userInfo = await this.authClient.send('user.findById', { userId: reporterId }).toPromise();
      
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

  private async getTargetInfo(targetType: ReportTargetType, targetId: string): Promise<{ title?: string; name?: string; type?: string } | undefined> {
    try {
      switch (targetType) {
        case ReportTargetType.USER:
          const userInfo = await this.authClient.send('user.findById', { userId: targetId }).toPromise();
          return userInfo ? { name: userInfo.name || userInfo.email, type: 'user' } : undefined;
          
        case ReportTargetType.CREATOR:
          // TODO: CreatorService 주입 후 실제 구현
          return { name: 'Creator Name', type: 'creator' };
          
        case ReportTargetType.CONTENT:
          // TODO: ContentService 주입 후 실제 구현
          return { title: 'Content Title', type: 'content' };
          
        default:
          return undefined;
      }
    } catch (error: unknown) {
      this.logger.warn('Failed to get target info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
      });
      return undefined;
    }
  }

  private async validateReportTarget(targetType: ReportTargetType, targetId: string): Promise<void> {
    // TODO: 실제 서비스들과 연동하여 대상 존재 확인
    // 현재는 기본 검증만 수행
    if (!targetId || targetId.trim().length === 0) {
      throw ReportException.invalidReportData();
    }
  }

  private calculateReportPriority(reason: ReportReason): number {
    // 신고 사유에 따른 우선순위 계산
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
      [ReportStatus.UNDER_REVIEW]: [ReportStatus.RESOLVED, ReportStatus.REJECTED, ReportStatus.DISMISSED],
      [ReportStatus.RESOLVED]: [], // 최종 상태
      [ReportStatus.REJECTED]: [], // 최종 상태
      [ReportStatus.DISMISSED]: [], // 최종 상태
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw ReportException.invalidStatusTransition();
    }
  }

  private async executeReportAction(
    report: ReportEntity,
    actions: { actionType: string; duration?: number; reason?: string }
  ): Promise<void> {
    try {
      this.logger.log('Executing report action', {
        reportId: report.id,
        actionType: actions.actionType,
        duration: actions.duration,
      });

      // TODO: 실제 조치 실행 로직 구현
      // - 경고: 사용자에게 경고 메시지 전송
      // - 정지: auth-service에 정지 요청
      // - 차단: auth-service에 차단 요청
      // - 콘텐츠 삭제: content-service에 삭제 요청

      this.logger.log('Report action executed successfully', {
        reportId: report.id,
        actionType: actions.actionType,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to execute report action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: report.id,
        actionType: actions.actionType,
      });
      // 조치 실행 실패는 전체 처리를 중단하지 않음
    }
  }
}