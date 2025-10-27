import { Module } from '@nestjs/common';

import { SharedRedisModule, REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config'; // 공통 패키지에서 import

import { RedisService } from './redis.service.js';

@Module({
  imports: [
    SharedRedisModule.register(REDIS_CLIENT_TOKEN), // 공통 패키지의 Redis 모듈 사용
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
