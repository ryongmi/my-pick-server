import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreatorModule } from '../creator/creator.module.js';
import { ContentModule } from '../content/content.module.js';

import { ApiQuotaUsageEntity } from './entities/index.js';
import { ApiQuotaUsageRepository } from './repositories/index.js';
import { YouTubeApiService, QuotaMonitorService, YouTubeSyncScheduler } from './services/index.js';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    TypeOrmModule.forFeature([ApiQuotaUsageEntity]),
    // Creator/Content 모듈 import
    CreatorModule,
    ContentModule,
  ],
  providers: [
    // Repositories
    ApiQuotaUsageRepository,

    // Services
    YouTubeApiService,
    QuotaMonitorService,
    YouTubeSyncScheduler,
  ],
  exports: [
    // 다른 모듈에서 사용할 수 있도록 export
    YouTubeApiService,
    QuotaMonitorService,
  ],
})
export class ExternalApiModule {}
