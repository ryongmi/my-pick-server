import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';

import { 
  ContentEntity, 
  ContentStatisticsEntity,
  ContentSyncMetadataEntity
} from './entities/index.js';
import { 
  ContentRepository,
  ContentSyncMetadataRepository
} from './repositories/index.js';
import { ContentService } from './services/index.js';
import {
  ContentController,
  ContentInteractionController,
  ContentBookmarkController,
  UserContentInteractionController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity, 
      ContentStatisticsEntity,
      ContentSyncMetadataEntity
    ]),
    UserInteractionModule,
  ],
  controllers: [
    ContentController,
    ContentInteractionController,
    ContentBookmarkController,
    UserContentInteractionController,
  ],
  providers: [
    ContentRepository, 
    ContentSyncMetadataRepository,
    ContentService
  ],
  exports: [
    ContentService, 
    ContentRepository,
    ContentSyncMetadataRepository
  ],
})
export class ContentModule {}