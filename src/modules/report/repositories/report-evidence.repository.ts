import { Injectable } from '@nestjs/common';

import { DataSource, Repository } from 'typeorm';

import { ReportEvidenceEntity } from '../entities/index.js';

@Injectable()
export class ReportEvidenceRepository extends Repository<ReportEvidenceEntity> {
  constructor(private dataSource: DataSource) {
    super(ReportEvidenceEntity, dataSource.createEntityManager());
  }

  async findByReportId(reportId: string): Promise<ReportEvidenceEntity | null> {
    return this.findOne({ where: { reportId } });
  }

  async saveEvidence(
    reportId: string,
    evidenceData: {
      screenshots?: string[];
      urls?: string[];
      additionalInfo?: Record<string, unknown>;
    }
  ): Promise<void> {
    const evidence = new ReportEvidenceEntity();
    evidence.reportId = reportId;

    if (evidenceData.screenshots !== undefined) {
      evidence.screenshots = evidenceData.screenshots;
    }
    if (evidenceData.urls !== undefined) {
      evidence.urls = evidenceData.urls;
    }
    if (evidenceData.additionalInfo !== undefined) {
      evidence.additionalInfo = evidenceData.additionalInfo;
    }

    await this.save(evidence);
  }

  async updateEvidence(
    reportId: string,
    evidenceData: Partial<{
      screenshots: string[];
      urls: string[];
      additionalInfo: Record<string, unknown> | null;
    }>
  ): Promise<void> {
    // exactOptionalPropertyTypes로 인한 타입 문제 해결을 위해 직접 update 호출
    const updateFields: Record<string, unknown> = {};

    if (evidenceData.screenshots !== undefined) {
      updateFields.screenshots = evidenceData.screenshots;
    }
    if (evidenceData.urls !== undefined) {
      updateFields.urls = evidenceData.urls;
    }
    if (evidenceData.additionalInfo !== undefined) {
      updateFields.additionalInfo = evidenceData.additionalInfo;
    }

    if (Object.keys(updateFields).length > 0) {
      await this.update({ reportId }, updateFields);
    }
  }

  async deleteByReportId(reportId: string): Promise<void> {
    await this.delete({ reportId });
  }
}
