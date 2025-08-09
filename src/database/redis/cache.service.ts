import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from './redis.service.js';

// 캐시 키 생성을 위한 enum
export enum CacheKeyType {
  CREATOR = 'creator',
  CONTENT = 'content',
  USER_INTERACTION = 'user_interaction',
  PLATFORM_STATS = 'platform_stats',
  TRENDING_CONTENT = 'trending_content',
  USER_SUBSCRIPTIONS = 'user_subscriptions',
}

// 캐시 TTL 설정 (초 단위)
export enum CacheTTL {
  SHORT = 300, // 5분
  MEDIUM = 1800, // 30분
  LONG = 3600, // 1시간
  VERY_LONG = 86400, // 24시간
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  // ==================== 캐시 키 생성 메서드 ====================

  private generateKey(type: CacheKeyType, identifier: string, suffix?: string): string {
    const key = `my-pick:${type}:${identifier}`;
    return suffix ? `${key}:${suffix}` : key;
  }

  // ==================== 기본 캐시 작업 ====================

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisService.getValue(key);
      if (!value) return null;

      const parsedValue = JSON.parse(value) as T;

      this.logger.debug('Cache hit', { key });
      return parsedValue;
    } catch (error: unknown) {
      this.logger.warn('Cache get failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: CacheTTL = CacheTTL.MEDIUM): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redisService.setExValue(key, ttl, serializedValue);

      this.logger.debug('Cache set', { key, ttl });
    } catch (error: unknown) {
      this.logger.warn('Cache set failed', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisService.deleteValue(key);
      this.logger.debug('Cache deleted', { key });
    } catch (error: unknown) {
      this.logger.warn('Cache delete failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== 크리에이터 캐시 메서드 ====================

  async getCreatorDetail(creatorId: string): Promise<any | null> {
    const key = this.generateKey(CacheKeyType.CREATOR, creatorId, 'detail');
    return this.get(key);
  }

  async setCreatorDetail(creatorId: string, data: any): Promise<void> {
    const key = this.generateKey(CacheKeyType.CREATOR, creatorId, 'detail');
    await this.set(key, data, CacheTTL.MEDIUM);
  }

  async deleteCreatorCache(creatorId: string): Promise<void> {
    const patterns = [
      this.generateKey(CacheKeyType.CREATOR, creatorId, 'detail'),
      this.generateKey(CacheKeyType.PLATFORM_STATS, creatorId),
    ];

    await Promise.all(patterns.map((key) => this.delete(key)));
  }

  // ==================== 콘텐츠 캐시 메서드 ====================

  async getContentDetail(contentId: string): Promise<any | null> {
    const key = this.generateKey(CacheKeyType.CONTENT, contentId, 'detail');
    return this.get(key);
  }

  async setContentDetail(contentId: string, data: any): Promise<void> {
    const key = this.generateKey(CacheKeyType.CONTENT, contentId, 'detail');
    await this.set(key, data, CacheTTL.MEDIUM);
  }

  async getTrendingContent(hours: number = 24): Promise<any | null> {
    const key = this.generateKey(CacheKeyType.TRENDING_CONTENT, `${hours}h`);
    return this.get(key);
  }

  async setTrendingContent(hours: number, data: any): Promise<void> {
    const key = this.generateKey(CacheKeyType.TRENDING_CONTENT, `${hours}h`);
    await this.set(key, data, CacheTTL.SHORT); // 트렌딩 콘텐츠는 짧은 TTL
  }

  // ==================== 플랫폼 통계 캐시 메서드 ====================

  async getPlatformStats(creatorId: string): Promise<any | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_STATS, creatorId);
    return this.get(key);
  }

  async setPlatformStats(creatorId: string, data: any): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_STATS, creatorId);
    await this.set(key, data, CacheTTL.LONG); // 통계는 긴 TTL
  }

  // ==================== 사용자 상호작용 캐시 메서드 ====================

  async getUserInteractions(userId: string, contentIds: string[]): Promise<any | null> {
    const key = this.generateKey(
      CacheKeyType.USER_INTERACTION,
      userId,
      contentIds.sort().join(',')
    );
    return this.get(key);
  }

  async setUserInteractions(userId: string, contentIds: string[], data: any): Promise<void> {
    const key = this.generateKey(
      CacheKeyType.USER_INTERACTION,
      userId,
      contentIds.sort().join(',')
    );
    await this.set(key, data, CacheTTL.SHORT); // 상호작용은 실시간성이 중요하므로 짧은 TTL
  }

  async deleteUserInteractionCache(userId: string): Promise<void> {
    // 패턴 매칭으로 사용자의 모든 상호작용 캐시 삭제
    // 실제 구현에서는 Redis SCAN 명령어 사용 고려
    const baseKey = this.generateKey(CacheKeyType.USER_INTERACTION, userId);
    this.logger.debug('User interaction cache invalidation requested', { baseKey });
  }

  // ==================== 구독 정보 캐시 메서드 ====================

  async getUserSubscriptions(userId: string): Promise<string[] | null> {
    const key = this.generateKey(CacheKeyType.USER_SUBSCRIPTIONS, userId);
    return this.get(key);
  }

  async setUserSubscriptions(userId: string, creatorIds: string[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_SUBSCRIPTIONS, userId);
    await this.set(key, creatorIds, CacheTTL.MEDIUM);
  }

  async deleteUserSubscriptionCache(userId: string): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_SUBSCRIPTIONS, userId);
    await this.delete(key);
  }

  // ==================== 배치 무효화 메서드 ====================

  async invalidateCreatorRelatedCaches(creatorId: string): Promise<void> {
    this.logger.log('Invalidating creator-related caches', { creatorId });
    await this.deleteCreatorCache(creatorId);
  }

  async invalidateContentRelatedCaches(contentId: string, creatorId?: string): Promise<void> {
    this.logger.log('Invalidating content-related caches', { contentId, creatorId });

    const deleteTasks = [
      this.delete(this.generateKey(CacheKeyType.CONTENT, contentId, 'detail')),
      this.delete(this.generateKey(CacheKeyType.TRENDING_CONTENT, '24h')),
    ];

    if (creatorId) {
      deleteTasks.push(this.deleteCreatorCache(creatorId));
    }

    await Promise.all(deleteTasks);
  }

  // ==================== 헬스체크 메서드 ====================

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime: number }> {
    const startTime = Date.now();

    try {
      const testKey = 'health-check';
      const testValue = 'ok';

      await this.redisService.setValue(testKey, testValue);
      const result = await this.redisService.getValue(testKey);
      await this.redisService.deleteValue(testKey);

      const responseTime = Date.now() - startTime;

      if (result === testValue) {
        return { status: 'healthy', responseTime };
      } else {
        return { status: 'unhealthy', responseTime };
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      });
      return { status: 'unhealthy', responseTime };
    }
  }
}
