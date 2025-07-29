import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { YouTubeApiService, TwitterApiService, ExternalApiSchedulerService, QuotaMonitorService } from './services';
import { ApiQuotaUsageEntity } from './entities';

import { CreatorModule } from '../creator/creator.module';
import { ContentModule } from '../content/content.module';
import { CreatorPlatformEntity } from '../creator/entities';

@Module({
  imports: [
    // HTTP 모듈 설정
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),

    // 설정 모듈
    ConfigModule,

    // 스케줄 모듈
    ScheduleModule.forRoot(),

    // TypeORM 엔티티
    TypeOrmModule.forFeature([CreatorPlatformEntity, ApiQuotaUsageEntity]),

    // 의존하는 도메인 모듈들
    CreatorModule,
    ContentModule,
  ],
  providers: [YouTubeApiService, TwitterApiService, ExternalApiSchedulerService, QuotaMonitorService],
  exports: [YouTubeApiService, TwitterApiService, ExternalApiSchedulerService, QuotaMonitorService],
})
export class ExternalApiModule {}

