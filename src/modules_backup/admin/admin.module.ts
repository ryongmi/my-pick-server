import { Module } from '@nestjs/common';

import { RedisModule } from '@database/redis/redis.module.js';

import { CreatorModule } from '../creator/creator.module.js';
import { UserSubscriptionModule } from '../user-subscription/user-subscription.module.js';
import { PlatformApplicationModule } from '../platform-application/platform-application.module.js';
import { ExternalApiModule } from '../external-api/external-api.module.js';
import { ContentModule } from '../content/content.module.js';
import { CreatorApplicationModule } from '../creator-application/creator-application.module.js';
import { ReportModule } from '../report/report.module.js';
import { UserInteractionModule } from '../user-interaction/user-interaction.module.js';

import {
  AdminDashboardService,
  AdminDashboardStatsService,
  AdminDashboardMetricsService,
  AdminDashboardHealthService,
  AdminCreatorService,
  AdminPlatformService,
} from './services/index.js';
import {
  AdminDashboardController,
  AdminCreatorController,
  AdminPlatformApplicationController,
  AdminContentController,
} from './controllers/index.js';

@Module({
  imports: [
    // 의존하는 도메인 모듈들
    CreatorModule,
    UserSubscriptionModule,
    PlatformApplicationModule,
    ExternalApiModule,
    ContentModule,
    CreatorApplicationModule,
    ReportModule,
    UserInteractionModule,
    // 인프라 모듈
    RedisModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminCreatorController,
    AdminPlatformApplicationController,
    AdminContentController,
  ],
  providers: [
    AdminDashboardService,
    AdminDashboardStatsService,
    AdminDashboardMetricsService,
    AdminDashboardHealthService,
    AdminCreatorService,
    AdminPlatformService,
  ],
  exports: [
    AdminDashboardService,
    AdminDashboardStatsService,
    AdminDashboardMetricsService,
    AdminDashboardHealthService,
    AdminCreatorService,
    AdminPlatformService,
  ],
})
export class AdminModule {}
