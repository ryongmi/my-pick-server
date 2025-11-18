import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '@modules/creator/creator.module.js';
import { UserInteractionModule } from '@modules/user-interaction/user-interaction.module.js';
import { ExternalApiModule } from '@modules/external-api/external-api.module.js';

import { ContentEntity } from './entities/content.entity.js';
import { ContentCategoryEntity } from './entities/content-category.entity.js';
import { ContentTagEntity } from './entities/content-tag.entity.js';
import { ContentModerationEntity } from './entities/content-moderation.entity.js';
import { ContentRepository } from './repositories/content.repository.js';
import { ContentCategoryRepository } from './repositories/content-category.repository.js';
import { ContentTagRepository } from './repositories/content-tag.repository.js';
import { ContentService } from './services/content.service.js';
import { ContentCategoryService } from './services/content-category.service.js';
import { ContentController } from './controllers/content.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentEntity,
      ContentCategoryEntity,
      ContentTagEntity,
      ContentModerationEntity,
    ]),
    // 순환 참조 방지를 위해 forwardRef 사용
    forwardRef(() => CreatorModule),
    UserInteractionModule,
    forwardRef(() => ExternalApiModule),
  ],
  controllers: [ContentController],
  providers: [
    ContentRepository,
    ContentCategoryRepository,
    ContentTagRepository,
    ContentService,
    ContentCategoryService,
  ],
  exports: [ContentService, ContentCategoryService],
})
export class ContentModule {}
