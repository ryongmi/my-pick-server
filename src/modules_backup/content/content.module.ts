import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '@database/redis/index.js';

import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';
import { ReportModule } from '../report/report.module.js';

import {
  ContentEntity,
  ContentStatisticsEntity,
  ContentCategoryEntity,
  ContentTagEntity,
  ContentInteractionEntity,
  ContentSyncEntity,
  ContentSyncMetadataEntity,
  ContentModerationEntity,
} from './entities/index.js';
import {
  ContentRepository,
  ContentStatisticsRepository,
  ContentCategoryRepository,
  ContentTagRepository,
  ContentInteractionRepository,
  ContentSyncRepository,
  ContentSyncMetadataRepository,
  ContentModerationRepository,
} from './repositories/index.js';
import {
  ContentService,
  ContentStatisticsService,
  ContentCategoryService,
  ContentTagService,
  ContentInteractionService,
  ContentSyncService,
  ContentSyncMetadataService,
  ContentOrchestrationService,
  ContentAdminStatisticsService,
  ContentModerationService,
} from './services/index.js';
import {
  ContentController,
  ContentBookmarkController,
  UserContentInteractionController,
  ContentCategoryController,
  ContentTagController,
  ContentAnalyticsController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity,
      ContentStatisticsEntity,
      ContentCategoryEntity,
      ContentTagEntity,
      ContentInteractionEntity,
      ContentSyncEntity,
      ContentSyncMetadataEntity,
      ContentModerationEntity,
    ]),
    RedisModule,
    UserInteractionModule,
    ReportModule,
  ],
  controllers: [
    ContentController,
    ContentBookmarkController,
    UserContentInteractionController,
    ContentCategoryController,
    ContentTagController,
    ContentAnalyticsController,
  ],
  providers: [
    // Repositories
    ContentRepository,
    ContentStatisticsRepository,
    ContentCategoryRepository,
    ContentTagRepository,
    ContentInteractionRepository,
    ContentSyncRepository,
    ContentSyncMetadataRepository,
    ContentModerationRepository,

    // Services
    ContentService,
    ContentStatisticsService,
    ContentCategoryService,
    ContentTagService,
    ContentInteractionService,
    ContentSyncService,
    ContentSyncMetadataService,
    ContentOrchestrationService,
    ContentAdminStatisticsService,
    ContentModerationService,
  ],
  exports: [
    ContentService,
    ContentRepository,
    ContentCategoryService,
    ContentTagService,
    ContentInteractionService,
    ContentSyncService,
    ContentOrchestrationService,
    ContentAdminStatisticsService,
  ],
})
export class ContentModule {}
