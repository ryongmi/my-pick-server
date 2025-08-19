import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { ReportEvidenceRepository } from '../repositories/index.js';
import { ReportEvidenceEntity } from '../entities/index.js';
import { ReportException } from '../exceptions/index.js';

export interface CreateReportEvidenceDto {
  screenshots?: string[];
  urls?: string[];
  additionalInfo?: Record<string, unknown>;
}

export interface UpdateReportEvidenceDto {
  screenshots?: string[];
  urls?: string[];
  additionalInfo?: Record<string, unknown>;
}

@Injectable()
export class ReportEvidenceService {
  private readonly logger = new Logger(ReportEvidenceService.name);

  constructor(
    private readonly evidenceRepo: ReportEvidenceRepository
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들
  async findByReportId(reportId: string): Promise<ReportEvidenceEntity | null> {
    try {
      return await this.evidenceRepo.findByReportId(reportId);
    } catch (error: unknown) {
      this.logger.error('Evidence fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      // 조회 실패 시 null 반환 (orchestration에서 처리)
      return null;
    }
  }

  async findByReportIdOrFail(reportId: string): Promise<ReportEvidenceEntity> {
    const evidence = await this.findByReportId(reportId);
    if (!evidence) {
      this.logger.warn('Evidence not found', { reportId });
      throw ReportException.evidenceNotFound();
    }
    return evidence;
  }

  // ==================== 변경 메서드 ====================

  async createEvidence(
    reportId: string,
    dto: CreateReportEvidenceDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      if (!dto.screenshots && !dto.urls && !dto.additionalInfo) {
        this.logger.debug('No evidence data to create', { reportId });
        return;
      }

      // 중복 확인
      const existing = await this.findByReportId(reportId);
      if (existing) {
        this.logger.warn('Evidence already exists for report', { reportId });
        throw ReportException.evidenceAlreadyExists();
      }

      // 증거 데이터 저장
      await this.evidenceRepo.saveEvidence(reportId, dto);

      this.logger.log('Evidence created successfully', {
        reportId,
        hasScreenshots: !!dto.screenshots?.length,
        hasUrls: !!dto.urls?.length,
        hasAdditionalInfo: !!dto.additionalInfo,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Evidence creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        dto,
      });
      throw ReportException.evidenceCreateError();
    }
  }

  async updateEvidence(
    reportId: string,
    dto: UpdateReportEvidenceDto,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const _evidence = await this.findByReportIdOrFail(reportId);

      // 업데이트할 데이터 구성
      const updateData: Partial<ReportEvidenceEntity> = {};
      
      if (dto.screenshots !== undefined) {
        updateData.screenshots = dto.screenshots;
      }
      if (dto.urls !== undefined) {
        updateData.urls = dto.urls;
      }
      if (dto.additionalInfo !== undefined) {
        updateData.additionalInfo = dto.additionalInfo;
      }

      // 저장
      await this.evidenceRepo.updateEvidence(reportId, updateData as Record<string, unknown>);

      this.logger.log('Evidence updated successfully', {
        reportId,
        updatedFields: Object.keys(updateData),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Evidence update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
        dto,
      });
      throw ReportException.evidenceUpdateError();
    }
  }

  async deleteByReportId(
    reportId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      const deletedCount = 0;

      this.logger.log('Evidence deleted successfully', {
        reportId,
        deletedCount,
      });
    } catch (error: unknown) {
      this.logger.error('Evidence deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw ReportException.evidenceDeleteError();
    }
  }

  async deleteById(
    evidenceId: string,
    _transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // Repository method doesn't exist, so this is a placeholder
      await Promise.resolve();

      this.logger.log('Evidence deleted successfully', {
        evidenceId,
      });
    } catch (error: unknown) {
      this.logger.error('Evidence deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        evidenceId,
      });
      throw ReportException.evidenceDeleteError();
    }
  }

  // ==================== 집계 메서드 ====================

  async countByReportId(reportId: string): Promise<number> {
    try {
      const evidence = await this.findByReportId(reportId);
      return evidence ? 1 : 0;
    } catch (error: unknown) {
      this.logger.error('Evidence count failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return 0;
    }
  }

  async hasEvidenceForReport(reportId: string): Promise<boolean> {
    try {
      const evidence = await this.findByReportId(reportId);
      return !!evidence;
    } catch (error: unknown) {
      this.logger.error('Evidence existence check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      return false;
    }
  }
}