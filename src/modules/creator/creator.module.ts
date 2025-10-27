import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorEntity } from './entities/creator.entity.js';
import { CreatorPlatformEntity } from './entities/creator-platform.entity.js';
import { CreatorRepository } from './repositories/creator.repository.js';
import { CreatorPlatformRepository } from './repositories/creator-platform.repository.js';
import { CreatorService } from './services/creator.service.js';
import { CreatorPlatformService } from './services/creator-platform.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CreatorEntity, CreatorPlatformEntity])],
  providers: [
    CreatorRepository,
    CreatorPlatformRepository,
    CreatorService,
    CreatorPlatformService,
  ],
  exports: [CreatorService, CreatorPlatformService],
})
export class CreatorModule {}
