import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/creator.module.js';
import { ExternalApiModule } from '../external-api/external-api.module.js';

import { CreatorApplicationEntity } from './entities/creator-application.entity.js';
import { CreatorApplicationRepository } from './repositories/creator-application.repository.js';
import { CreatorApplicationService } from './services/creator-application.service.js';
import {
  CreatorApplicationController,
  CreatorApplicationAdminController,
} from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorApplicationEntity]),
    CreatorModule, // Creator, CreatorPlatform 서비스 사용
    ExternalApiModule, // YouTube API 사용
  ],
  controllers: [CreatorApplicationController, CreatorApplicationAdminController],
  providers: [CreatorApplicationRepository, CreatorApplicationService],
  exports: [CreatorApplicationService],
})
export class CreatorApplicationModule {}
