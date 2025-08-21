import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '@database/redis/index.js';
import { SharedClientsModule } from '@common/clients/shared-clients.module.js';

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
import { 
  ReportService, 
  ReportReviewService, 
  ReportStatisticsService,
  ReportOrchestrationService,
  ReportEvidenceService,
  ReportActionService,
} from './services/index.js';
import { ReportController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportEntity,
      ReportEvidenceEntity,
      ReportReviewEntity,
      ReportActionEntity,
    ]),
    RedisModule,
    SharedClientsModule,
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
    ReportOrchestrationService,
    ReportEvidenceService,
    ReportActionService,
  ],
  exports: [
    ReportService,
    ReportReviewService,
    ReportStatisticsService,
    ReportOrchestrationService,
    ReportEvidenceService,
    ReportActionService,
    ReportRepository,
    ReportEvidenceRepository,
    ReportReviewRepository,
    ReportActionRepository,
  ],
})
export class ReportModule {}
