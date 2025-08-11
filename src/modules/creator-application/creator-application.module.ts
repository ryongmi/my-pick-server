import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/index.js';

import {
  CreatorApplicationEntity,
  CreatorApplicationChannelInfoEntity,
  CreatorApplicationSampleVideoEntity,
  CreatorApplicationReviewEntity,
} from './entities/index.js';
import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
} from './repositories/index.js';
import { 
  CreatorApplicationService,
  CreatorApplicationOrchestrationService,
  CreatorApplicationStatisticsService,
  CreatorApplicationRequirementService,
  CreatorApplicationReviewService,
} from './services/index.js';
import { CreatorApplicationController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorApplicationEntity,
      CreatorApplicationChannelInfoEntity,
      CreatorApplicationSampleVideoEntity,
      CreatorApplicationReviewEntity,
    ]),
    CreatorModule, // CreatorService 사용을 위해 필요
  ],
  controllers: [CreatorApplicationController],
  providers: [
    // Repositories
    CreatorApplicationRepository,
    CreatorApplicationChannelInfoRepository,
    CreatorApplicationSampleVideoRepository,
    CreatorApplicationReviewRepository,
    
    // Services
    CreatorApplicationService,
    CreatorApplicationOrchestrationService,
    CreatorApplicationStatisticsService,
    CreatorApplicationRequirementService,
    CreatorApplicationReviewService,
  ],
  exports: [
    // Services
    CreatorApplicationService,
    CreatorApplicationOrchestrationService,
    CreatorApplicationStatisticsService,
    CreatorApplicationRequirementService,
    CreatorApplicationReviewService,
    
    // Repositories  
    CreatorApplicationRepository,
    CreatorApplicationChannelInfoRepository,
    CreatorApplicationSampleVideoRepository,
    CreatorApplicationReviewRepository,
  ],
})
export class CreatorApplicationModule {}
