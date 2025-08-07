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

  async saveEvidence(reportId: string, evidenceData: {
    screenshots?: string[];
    urls?: string[];
    additionalInfo?: Record<string, unknown>;
  }): Promise<void> {
    const evidence = new ReportEvidenceEntity();
    evidence.reportId = reportId;
    evidence.screenshots = evidenceData.screenshots;
    evidence.urls = evidenceData.urls;
    evidence.additionalInfo = evidenceData.additionalInfo;

    await this.save(evidence);
  }

  async updateEvidence(reportId: string, evidenceData: Partial<{
    screenshots: string[];
    urls: string[];
    additionalInfo: Record<string, unknown>;
  }>): Promise<void> {
    await this.update({ reportId }, evidenceData);
  }

  async deleteByReportId(reportId: string): Promise<void> {
    await this.delete({ reportId });
  }
}