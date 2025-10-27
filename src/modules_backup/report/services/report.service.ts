import { Injectable, Logger, Inject, HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';
import { LimitType } from '@krgeobuk/core/enum';

import { CacheService } from '@database/redis/cache.service.js';

import { ReportRepository } from '../repositories/index.js';
import {
  ReportEntity,
} from '../entities/index.js';
import { ReportStatus, ReportTargetType, ReportReason } from '../enums/index.js';
import { ReportException } from '../exceptions/index.js';
import {
  CreateReportDto,
  ReportSearchQueryDto,
  ReportDetailDto,
} from '../dto/index.js';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly cacheService: CacheService,
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

      // 상세 정보 구성 - 배치 처리로 최적화
      const detailedReports = await this.buildReportDetailsBatch(reports);

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
  ): Promise<string> {
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

      this.logger.log('Report created successfully', {
        reportId: report.id,
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        priority,
      });

      return report.id;
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


  async deleteReport(reportId: string, _transactionManager?: EntityManager): Promise<void> {
    try {
      const report = await this.findByIdOrFail(reportId);

      // 검토 완료된 신고 삭제 방지
      if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
        throw ReportException.cannotDeleteReviewedReport();
      }

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

  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      await this.reportRepo.updateReport(reportId, { status });

      this.logger.log('Report status updated successfully', {
        reportId,
        status,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Report status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        status,
      });
      throw ReportException.reportUpdateError();
    }
  }

  async getCountByTarget(targetType: ReportTargetType, targetId: string): Promise<number> {
    try {
      this.logger.debug('Getting report count by target', { targetType, targetId });

      return await this.reportRepo.getCountByTarget(targetType, targetId);
    } catch (error: unknown) {
      this.logger.error('Failed to get report count by target', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetType,
        targetId,
      });
      return 0;
    }
  }

  async updateReportPriority(reportId: string, priority: number, _transactionManager?: EntityManager): Promise<void> {
    try {
      this.logger.debug('Updating report priority', { reportId, priority });

      const report = await this.findByIdOrFail(reportId);
      
      // Priority validation (1: High, 2: Normal, 3: Low)
      if (priority < 1 || priority > 3) {
        throw new Error('Priority must be between 1 and 3');
      }

      await this.reportRepo.update({ id: reportId }, { priority });

      this.logger.log('Report priority updated successfully', {
        reportId,
        oldPriority: report.priority,
        newPriority: priority,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update report priority', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        priority,
      });
      throw ReportException.reportUpdateError();
    }
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

      throw ReportException.reportFetchError();
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async buildReportDetail(report: ReportEntity): Promise<ReportDetailDto> {
    return await this.executeWithErrorHandling(
      async () => {
        // 외부 정보만 조회 (증거는 OrchestrationService에서 처리)
        const [reporterInfo, targetInfo] = await Promise.all([
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

        if (reporterInfo !== undefined) {
          result.reporterInfo = reporterInfo;
        }
        if (targetInfo !== undefined) {
          result.targetInfo = targetInfo;
        }

        return result;
      },
      'Build report detail',
      { reportId: report.id },
      // 최소한의 정보만 포함한 기본 결과를 fallback으로 제공
      {
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        description: report.description || '',
      } as ReportDetailDto
    );
  }

  private async getReporterInfo(
    reporterId: string
  ): Promise<{ email: string; name?: string } | undefined> {
    return await this.executeWithErrorHandling(
      async () => {
        const userInfo = await this.authClient
          .send('user.findById', { userId: reporterId })
          .toPromise();

        if (userInfo) {
          return {
            email: userInfo.email,
            name: userInfo.name,
          };
        }

        return undefined;
      },
      'Get reporter info',
      { reporterId },
      undefined
    );
  }

  async getReporterInfoBatch(
    reporterIds: string[]
  ): Promise<Record<string, { email: string; name?: string }>> {
    if (reporterIds.length === 0) return {};

    return await this.executeWithErrorHandling(
      async () => {
        // 비어있는 ID 제거 및 중복 제거
        const uniqueIds = [...new Set(reporterIds.filter(id => id && id.trim().length > 0))];
        
        if (uniqueIds.length === 0) return {};

        // 배치 사용자 정보 조회
        const usersInfo = await this.authClient
          .send('user.findByIds', { userIds: uniqueIds })
          .toPromise();

        const result: Record<string, { email: string; name?: string }> = {};
        
        if (Array.isArray(usersInfo)) {
          usersInfo.forEach((userInfo: Record<string, unknown>) => {
            if (userInfo && userInfo.id) {
              result[userInfo.id as string] = {
                email: userInfo.email as string,
                name: userInfo.name as string,
              };
            }
          });
        }

        this.logger.debug('Batch reporter info retrieved', {
          requestedCount: uniqueIds.length,
          retrievedCount: Object.keys(result).length,
        });

        return result;
      },
      'Get reporter info batch',
      { reporterIdsCount: reporterIds.length },
      {}
    );
  }

  private async getTargetInfo(
    targetType: ReportTargetType,
    targetId: string
  ): Promise<{ title?: string; name?: string; type?: string } | undefined> {
    return await this.executeWithErrorHandling(
      async () => {
        switch (targetType) {
          case ReportTargetType.USER: {
            const userInfo = await this.authClient
              .send('user.findById', { userId: targetId })
              .toPromise();
            return userInfo ? { name: userInfo.name || userInfo.email, type: 'user' } : undefined;
          }

          case ReportTargetType.CREATOR: {
            const creatorInfo = await this.authClient
              .send('creator.findById', { creatorId: targetId })
              .toPromise();
            return creatorInfo
              ? {
                  name: (creatorInfo.displayName || creatorInfo.name) as string,
                  type: 'creator',
                }
              : { name: `Creator ${targetId}`, type: 'creator' };
          }

          case ReportTargetType.CONTENT: {
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
          }

          default:
            return undefined;
        }
      },
      'Get target info',
      { targetType, targetId },
      // 기본값 반환
      targetType === ReportTargetType.CREATOR
        ? { name: `Creator ${targetId}`, type: 'creator' }
        : targetType === ReportTargetType.CONTENT
          ? { title: `Content ${targetId}`, type: 'content' }
          : undefined
    );
  }

  async getTargetInfoBatch(
    targets: Array<{ targetType: ReportTargetType; targetId: string }>
  ): Promise<Record<string, { title?: string; name?: string; type?: string }>> {
    if (targets.length === 0) return {};

    return await this.executeWithErrorHandling(
      async () => {
        // 타입별로 그룹화
        const userIds: string[] = [];
        const creatorIds: string[] = [];
        const contentIds: string[] = [];

        targets.forEach(({ targetType, targetId }) => {
          if (!targetId || targetId.trim().length === 0) return;
          
          switch (targetType) {
            case ReportTargetType.USER:
              if (!userIds.includes(targetId)) userIds.push(targetId);
              break;
            case ReportTargetType.CREATOR:
              if (!creatorIds.includes(targetId)) creatorIds.push(targetId);
              break;
            case ReportTargetType.CONTENT:
              if (!contentIds.includes(targetId)) contentIds.push(targetId);
              break;
          }
        });

        const [usersInfo, creatorsInfo, contentsInfo] = await Promise.all([
          userIds.length > 0
            ? this.authClient.send('user.findByIds', { userIds }).toPromise()
            : Promise.resolve([]),
          creatorIds.length > 0
            ? this.authClient.send('creator.findByIds', { creatorIds }).toPromise()
            : Promise.resolve([]),
          contentIds.length > 0
            ? this.authClient.send('content.findByIds', { contentIds }).toPromise()
            : Promise.resolve([]),
        ]);

        const result: Record<string, { title?: string; name?: string; type?: string }> = {};

        // 사용자 정보 처리
        if (Array.isArray(usersInfo)) {
          usersInfo.forEach((userInfo: Record<string, unknown>) => {
            if (userInfo && userInfo.id) {
              result[`${ReportTargetType.USER}:${userInfo.id}`] = {
                name: (userInfo.name || userInfo.email) as string,
                type: 'user',
              };
            }
          });
        }

        // 크리에이터 정보 처리
        if (Array.isArray(creatorsInfo)) {
          creatorsInfo.forEach((creatorInfo: Record<string, unknown>) => {
            if (creatorInfo && creatorInfo.id) {
              result[`${ReportTargetType.CREATOR}:${creatorInfo.id}`] = {
                name: (creatorInfo.displayName || creatorInfo.name) as string,
                type: 'creator',
              };
            }
          });
        }

        // 콘텐츠 정보 처리
        if (Array.isArray(contentsInfo)) {
          contentsInfo.forEach((contentInfo: Record<string, unknown>) => {
            if (contentInfo && contentInfo.id) {
              result[`${ReportTargetType.CONTENT}:${contentInfo.id}`] = {
                title: contentInfo.title as string,
                name: contentInfo.title as string,
                type: 'content',
              };
            }
          });
        }

        // 누락된 데이터에 대해 기본값 설정
        targets.forEach(({ targetType, targetId }) => {
          const key = `${targetType}:${targetId}`;
          if (!result[key]) {
            switch (targetType) {
              case ReportTargetType.CREATOR:
                result[key] = { name: `Creator ${targetId}`, type: 'creator' };
                break;
              case ReportTargetType.CONTENT:
                result[key] = { title: `Content ${targetId}`, type: 'content' };
                break;
              case ReportTargetType.USER:
                result[key] = { name: `User ${targetId}`, type: 'user' };
                break;
            }
          }
        });

        this.logger.debug('Batch target info retrieved', {
          userCount: userIds.length,
          creatorCount: creatorIds.length,
          contentCount: contentIds.length,
          resultCount: Object.keys(result).length,
        });

        return result;
      },
      'Get target info batch',
      { targetsCount: targets.length },
      {}
    );
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

  // ==================== 배치 처리 메서드 ====================

  private async buildReportDetailsBatch(reports: ReportEntity[]): Promise<ReportDetailDto[]> {
    if (reports.length === 0) return [];

    return await this.executeWithErrorHandling(
      async () => {
        // 1. 배치 외부 데이터 조회 (증거는 OrchestrationService에서 처리)
        const reporterIds = [...new Set(reports.map(r => r.reporterId).filter(id => id))];
        const targets = reports.map(r => ({ targetType: r.targetType, targetId: r.targetId }));

        const [reportersInfo, targetsInfo] = await Promise.all([
          this.getReporterInfoBatch(reporterIds),
          this.getTargetInfoBatch(targets),
        ]);

        // 2. 결과 조합
        const results = reports.map((report) => {
          const reporterInfo = reportersInfo[report.reporterId];
          const targetInfo = targetsInfo[`${report.targetType}:${report.targetId}`];

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

          // 선택적 속성 처리
          if (report.description !== undefined) {
            result.description = report.description || '';
          }

          if (reporterInfo !== undefined) {
            result.reporterInfo = reporterInfo;
          }
          if (targetInfo !== undefined) {
            result.targetInfo = targetInfo;
          }

          return result;
        });

        this.logger.debug('Batch report details built', {
          reportCount: reports.length,
          reporterCount: reporterIds.length,
          targetCount: targets.length,
        });

        return results;
      },
      'Build report details batch',
      { reportCount: reports.length },
      // fallback: 배치 처리가 실패하면 기본 정보만 폴백
      reports.map(report => ({
        id: report.id,
        reporterId: report.reporterId,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        priority: report.priority,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        description: report.description || '',
      } as ReportDetailDto))
    );
  }
}
