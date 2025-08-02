import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';

import { ContentEntity, ContentStatisticsEntity } from './entities/index.js';
import { ContentRepository } from './repositories/index.js';
import { ContentService } from './services/index.js';
import {
  ContentController,
  ContentBookmarkController,
  UserContentInteractionController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentEntity, ContentStatisticsEntity]),
    UserInteractionModule,
  ],
  controllers: [
    ContentController,
    ContentBookmarkController,
    UserContentInteractionController,
  ],
  providers: [ContentRepository, ContentService],
  exports: [ContentService, ContentRepository],
})
export class ContentModule {}