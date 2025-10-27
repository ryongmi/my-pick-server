import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/index.js';

import {
  CreatorApplicationEntity,
  CreatorApplicationChannelInfoEntity,
  CreatorApplicationSampleVideoEntity,
  CreatorApplicationReviewEntity,
  CreatorApplicationRequirementEntity,
} from './entities/index.js';
import {
  CreatorApplicationRepository,
  CreatorApplicationChannelInfoRepository,
  CreatorApplicationSampleVideoRepository,
  CreatorApplicationReviewRepository,
  CreatorApplicationRequirementRepository,
} from './repositories/index.js';
import { 
  CreatorApplicationService,
  CreatorApplicationOrchestrationService,
  CreatorApplicationStatisticsService,
  CreatorApplicationRequirementService,
  CreatorApplicationReviewService,
  CreatorApplicationChannelInfoService,
  CreatorApplicationSampleVideoService,
} from './services/index.js';
import { CreatorApplicationController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorApplicationEntity,
      CreatorApplicationChannelInfoEntity,
      CreatorApplicationSampleVideoEntity,
      CreatorApplicationReviewEntity,
      CreatorApplicationRequirementEntity,
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
    CreatorApplicationRequirementRepository,
    
    // Services
    CreatorApplicationService,
    CreatorApplicationOrchestrationService,
    CreatorApplicationStatisticsService,
    CreatorApplicationRequirementService,
    CreatorApplicationReviewService,
    CreatorApplicationChannelInfoService,
    CreatorApplicationSampleVideoService,
  ],
  exports: [
    // Services
    CreatorApplicationService,
    CreatorApplicationOrchestrationService,
    CreatorApplicationStatisticsService,
    CreatorApplicationRequirementService,
    CreatorApplicationReviewService,
    CreatorApplicationChannelInfoService,
    CreatorApplicationSampleVideoService,
    
    // Repositories  
    CreatorApplicationRepository,
    CreatorApplicationChannelInfoRepository,
    CreatorApplicationSampleVideoRepository,
    CreatorApplicationReviewRepository,
    CreatorApplicationRequirementRepository,
  ],
})
export class CreatorApplicationModule {}
