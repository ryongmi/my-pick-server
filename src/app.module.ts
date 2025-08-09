import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { WinstonModule } from 'nest-winston';

import { SerializerInterceptor } from '@krgeobuk/core/interceptors';
import { winstonConfig } from '@krgeobuk/core/logger';

import { RedisModule, DatabaseModule } from '@database/index.js';
import { AppConfigModule } from '@config/index.js';
import { SharedClientsModule } from '@common/clients/index.js';
import { AuthorizationGuardModule } from '@common/authorization/index.js';
import { JwtModule } from '@common/jwt/index.js';
import {
  CreatorModule,
  UserSubscriptionModule,
  ExternalApiModule,
  PlatformApplicationModule,
  AdminModule,
  ContentModule,
  ReportModule,
  CreatorApplicationModule,
  UserInteractionModule,
  HealthModule,
} from '@modules/index.js';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    AppConfigModule,
    // TCP 연결 모듈
    SharedClientsModule,
    // authorization guard DI 주입 전용 모듈
    AuthorizationGuardModule,
    // JWT ACCESS TOKEN PUBLIC KEY
    JwtModule,
    DatabaseModule,
    RedisModule,
    // Health Check
    HealthModule,
    // Phase 1: Creator Management System
    CreatorModule,
    UserSubscriptionModule,
    CreatorApplicationModule,
    // Phase 2: Content Management System
    ContentModule,
    UserInteractionModule,
    // Phase 4: Report System
    ReportModule,
    // Phase 5: Admin System
    AdminModule,
    // Phase 6: External API Integration
    ExternalApiModule,
    // Platform Application Management
    PlatformApplicationModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SerializerInterceptor,
    },
  ], // Reflector는 자동 주입됨
})
export class AppModule {}
