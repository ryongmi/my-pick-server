import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

import { BaseRedisService } from '@krgeobuk/database-config/redis';
import { REDIS_CLIENT_TOKEN } from '@krgeobuk/database-config/constants';

// import { _REDIS_BASE_KEYS } from '@common/constants/index.js';
import { RedisConfig } from '@/common/interfaces/index.js';

@Injectable()
export class RedisService extends BaseRedisService {
  constructor(@Inject(REDIS_CLIENT_TOKEN) redisClient: Redis, configService: ConfigService) {
    const keyPrefix = configService.get<RedisConfig['keyPrefix']>('redis.keyPrefix') ?? '';
    super(redisClient, keyPrefix);
  }
}
