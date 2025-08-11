import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '@database/redis/index.js';

import { UserSubscriptionModule } from '../user-subscription/user-subscription.module.js';

import {
  CreatorEntity,
  CreatorPlatformEntity,
  CreatorPlatformSyncEntity,
  CreatorConsentEntity,
  CreatorStatisticsEntity,
  CreatorPlatformStatisticsEntity,
  CreatorCategoryStatisticsEntity,
} from './entities/index.js';
import {
  CreatorRepository,
  CreatorPlatformRepository,
  CreatorPlatformSyncRepository,
  CreatorConsentRepository,
  CreatorStatisticsRepository,
  CreatorPlatformStatisticsRepository,
  CreatorCategoryStatisticsRepository,
} from './repositories/index.js';
import {
  CreatorService,
  CreatorPlatformService,
  CreatorPlatformSyncService,
  CreatorSyncProcessorService,
  CreatorSyncSchedulerService,
  CreatorConsentService,
  CreatorStatisticsService,
  CreatorPlatformStatisticsService,
  CreatorCategoryStatisticsService,
  CreatorOrchestrationService,
  CreatorAggregateService,
} from './services/index.js';
import { CreatorController } from './controllers/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreatorEntity,
      CreatorPlatformEntity,
      CreatorPlatformSyncEntity,
      CreatorConsentEntity,
      CreatorStatisticsEntity,
      CreatorPlatformStatisticsEntity,
      CreatorCategoryStatisticsEntity,
    ]),
    RedisModule,
    UserSubscriptionModule,
  ],
  controllers: [CreatorController],
  providers: [
    // Repositories
    CreatorRepository,
    CreatorPlatformRepository,
    CreatorPlatformSyncRepository,
    CreatorConsentRepository,
    CreatorStatisticsRepository,
    CreatorPlatformStatisticsRepository,
    CreatorCategoryStatisticsRepository,

    // Services
    CreatorService,
    CreatorPlatformService,
    CreatorPlatformSyncService,
    CreatorSyncProcessorService,
    CreatorSyncSchedulerService,
    CreatorConsentService,
    CreatorStatisticsService,
    CreatorPlatformStatisticsService,
    CreatorCategoryStatisticsService,
    CreatorOrchestrationService,
    CreatorAggregateService,
  ],
  exports: [
    // 다른 모듈에서 사용할 수 있도록 서비스 export
    CreatorService,
    CreatorPlatformService,
    CreatorPlatformSyncService,
    CreatorSyncProcessorService,
    CreatorSyncSchedulerService,
    CreatorConsentService,
    CreatorStatisticsService,
    CreatorPlatformStatisticsService,
    CreatorCategoryStatisticsService,
    CreatorOrchestrationService,
    CreatorAggregateService,
  ],
})
export class CreatorModule {}
