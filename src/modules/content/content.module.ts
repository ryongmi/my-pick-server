import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentEntity, ContentStatisticsEntity } from './entities';
import { ContentRepository } from './repositories';
import { ContentService } from './services';
import {
  ContentController,
  ContentBookmarkController,
  UserContentInteractionController,
  ContentTcpController,
} from './controllers';
import { UserInteractionModule } from '../user-interaction/user-interaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentEntity, ContentStatisticsEntity]),
    UserInteractionModule,
  ],
  controllers: [
    ContentController,
    ContentBookmarkController,
    UserContentInteractionController,
    ContentTcpController,
  ],
  providers: [ContentRepository, ContentService],
  exports: [ContentService, ContentRepository],
})
export class ContentModule {}