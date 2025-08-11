import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ReportEntity,
  ReportEvidenceEntity,
  ReportReviewEntity,
  ReportActionEntity,
} from './entities/index.js';
import {
  ReportRepository,
  ReportEvidenceRepository,
  ReportReviewRepository,
  ReportActionRepository,
} from './repositories/index.js';
import { ReportService, ReportReviewService, ReportStatisticsService } from './services/index.js';
import { ReportController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportEntity,
      ReportEvidenceEntity,
      ReportReviewEntity,
      ReportActionEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [
    ReportRepository,
    ReportEvidenceRepository,
    ReportReviewRepository,
    ReportActionRepository,
    ReportService,
    ReportReviewService,
    ReportStatisticsService,
  ],
  exports: [
    ReportService,
    ReportReviewService,
    ReportStatisticsService,
    ReportRepository,
    ReportEvidenceRepository,
    ReportReviewRepository,
    ReportActionRepository,
  ],
})
export class ReportModule {}
