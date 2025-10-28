import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { WinstonModule } from 'nest-winston';

import { SerializerInterceptor } from '@krgeobuk/core/interceptors';
import { winstonConfig } from '@krgeobuk/core/logger';

import { RedisModule, DatabaseModule } from '@database/index.js';
import { AppConfigModule } from '@config/index.js';
import { SharedClientsModule } from '@common/clients/index.js';
import { JwtModule } from '@common/jwt/index.js';
import {
  CreatorModule,
  UserSubscriptionModule,
  ExternalApiModule,
  ContentModule,
  CreatorApplicationModule,
} from '@modules/index.js';
import { ImageModule } from '@modules/image/image.module.js';

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    AppConfigModule,
    // TCP 연결 모듈
    SharedClientsModule,
    // JWT ACCESS TOKEN PUBLIC KEY
    JwtModule,
    DatabaseModule,
    RedisModule,
    // Phase 1: Creator Management System
    CreatorModule,
    UserSubscriptionModule,
    CreatorApplicationModule,
    // Phase 2: Content Management System
    ContentModule,
    // Phase 6: External API Integration
    ExternalApiModule,
    // Image Proxy Module
    ImageModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SerializerInterceptor,
    },
  ], // Reflector는 자동 주입됨
})
export class AppModule {}
