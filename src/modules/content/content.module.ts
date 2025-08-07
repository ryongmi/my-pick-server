import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';

import { 
  ContentEntity, 
  ContentStatisticsEntity,
  ContentCategoryEntity,
  ContentTagEntity,
  ContentInteractionEntity,
  ContentSyncEntity,
  ContentSyncMetadataEntity,
} from './entities/index.js';
import { 
  ContentRepository,
  ContentCategoryRepository,
  ContentTagRepository,
  ContentInteractionRepository,
  ContentSyncRepository,
  ContentSyncMetadataRepository,
} from './repositories/index.js';
import { 
  ContentService,
  ContentCategoryService,
  ContentTagService,
  ContentInteractionService,
  ContentSyncService,
  ContentSyncMetadataService,
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
    ]),
    UserInteractionModule,
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
    ContentCategoryRepository,
    ContentTagRepository,
    ContentInteractionRepository,
    ContentSyncRepository,
    ContentSyncMetadataRepository,
    
    // Services
    ContentService,
    ContentCategoryService,
    ContentTagService,
    ContentInteractionService,
    ContentSyncService,
    ContentSyncMetadataService,
  ],
  exports: [
    ContentService,
    ContentRepository,
    ContentCategoryService,
    ContentTagService,
    ContentInteractionService,
    ContentSyncService,
  ],
})
export class ContentModule {}