import { Injectable, Logger } from '@nestjs/common';

import { CreatorDetailDto, DetailedPlatformStatsDto } from '@modules/creator/dto/creator-detail.dto.js';
import { ContentDetailDto } from '@modules/content/dto/content-detail.dto.js';
import { TrendingContentDto } from '@modules/content/dto/trending-content.dto.js';
import { UpdateInteractionDto } from '@modules/user-interaction/dto/interaction.dto.js';

import { RedisService } from './redis.service.js';

// 캐시 키 생성을 위한 enum
export enum CacheKeyType {
  CREATOR = 'creator',
  CONTENT = 'content',
  USER_INTERACTION = 'user_interaction',
  PLATFORM_STATS = 'platform_stats',
  TRENDING_CONTENT = 'trending_content',
  USER_SUBSCRIPTIONS = 'user_subscriptions',
  USER_BOOKMARKS = 'user_bookmarks',
  USER_LIKES = 'user_likes',
  USER_CREATOR_SUBSCRIPTIONS = 'user_creator_subscriptions',
  CREATOR_SUBSCRIBERS = 'creator_subscribers',
  REPORT_STATISTICS = 'report_statistics',
  REPORT_DISTRIBUTION = 'report_distribution',
  REPORT_TRENDS = 'report_trends',
  PLATFORM_APPLICATION_STATS = 'platform_application_stats',
  PLATFORM_APPLICATION_DISTRIBUTION = 'platform_application_distribution',
  PLATFORM_APPLICATION_TRENDS = 'platform_application_trends',
  PLATFORM_APPLICATION_SEARCH = 'platform_application_search',
  ADMIN_DASHBOARD_STATS = 'admin_dashboard_stats',
  ADMIN_DASHBOARD_METRICS = 'admin_dashboard_metrics',
  ADMIN_DASHBOARD_HEALTH = 'admin_dashboard_health',
  ADMIN_DASHBOARD_OVERVIEW = 'admin_dashboard_overview',
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

  async getCreatorDetail(creatorId: string): Promise<CreatorDetailDto | null> {
    const key = this.generateKey(CacheKeyType.CREATOR, creatorId, 'detail');
    return this.get(key);
  }

  async setCreatorDetail(creatorId: string, data: CreatorDetailDto): Promise<void> {
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

  async getContentDetail(contentId: string): Promise<ContentDetailDto | null> {
    const key = this.generateKey(CacheKeyType.CONTENT, contentId, 'detail');
    return this.get(key);
  }

  async setContentDetail(contentId: string, data: ContentDetailDto): Promise<void> {
    const key = this.generateKey(CacheKeyType.CONTENT, contentId, 'detail');
    await this.set(key, data, CacheTTL.MEDIUM);
  }

  async getTrendingContent(hours: number = 24): Promise<TrendingContentDto[] | null> {
    const key = this.generateKey(CacheKeyType.TRENDING_CONTENT, `${hours}h`);
    return this.get(key);
  }

  async setTrendingContent(hours: number, data: TrendingContentDto[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.TRENDING_CONTENT, `${hours}h`);
    await this.set(key, data, CacheTTL.SHORT); // 트렌딩 콘텐츠는 짧은 TTL
  }

  // ==================== 플랫폼 통계 캐시 메서드 ====================

  async getPlatformStats(creatorId: string): Promise<DetailedPlatformStatsDto | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_STATS, creatorId);
    return this.get(key);
  }

  async setPlatformStats(creatorId: string, data: DetailedPlatformStatsDto): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_STATS, creatorId);
    await this.set(key, data, CacheTTL.LONG); // 통계는 긴 TTL
  }

  // ==================== 사용자 상호작용 캐시 메서드 ====================

  async getUserInteractions(userId: string, contentIds: string[]): Promise<Record<string, UpdateInteractionDto> | null> {
    const key = this.generateKey(
      CacheKeyType.USER_INTERACTION,
      userId,
      contentIds.sort().join(',')
    );
    return this.get(key);
  }

  async setUserInteractions(userId: string, contentIds: string[], data: Record<string, UpdateInteractionDto>): Promise<void> {
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

  // ==================== 사용자 상호작용 목록 캐시 메서드 ====================

  async getUserBookmarks(userId: string): Promise<string[] | null> {
    const key = this.generateKey(CacheKeyType.USER_BOOKMARKS, userId);
    return this.get(key);
  }

  async setUserBookmarks(userId: string, contentIds: string[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_BOOKMARKS, userId);
    await this.set(key, contentIds, CacheTTL.MEDIUM);
  }

  async deleteUserBookmarksCache(userId: string): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_BOOKMARKS, userId);
    await this.delete(key);
  }

  async getUserLikes(userId: string): Promise<string[] | null> {
    const key = this.generateKey(CacheKeyType.USER_LIKES, userId);
    return this.get(key);
  }

  async setUserLikes(userId: string, contentIds: string[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_LIKES, userId);
    await this.set(key, contentIds, CacheTTL.MEDIUM);
  }

  async deleteUserLikesCache(userId: string): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_LIKES, userId);
    await this.delete(key);
  }

  // ==================== 사용자 구독 관계 캐시 메서드 ====================

  async getUserCreatorSubscriptions(userId: string): Promise<string[] | null> {
    const key = this.generateKey(CacheKeyType.USER_CREATOR_SUBSCRIPTIONS, userId);
    return this.get(key);
  }

  async setUserCreatorSubscriptions(userId: string, creatorIds: string[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_CREATOR_SUBSCRIPTIONS, userId);
    await this.set(key, creatorIds, CacheTTL.LONG); // 구독 관계는 변경 빈도 낮음
  }

  async deleteUserCreatorSubscriptionsCache(userId: string): Promise<void> {
    const key = this.generateKey(CacheKeyType.USER_CREATOR_SUBSCRIPTIONS, userId);
    await this.delete(key);
  }

  async getCreatorSubscribers(creatorId: string): Promise<string[] | null> {
    const key = this.generateKey(CacheKeyType.CREATOR_SUBSCRIBERS, creatorId);
    return this.get(key);
  }

  async setCreatorSubscribers(creatorId: string, userIds: string[]): Promise<void> {
    const key = this.generateKey(CacheKeyType.CREATOR_SUBSCRIBERS, creatorId);
    await this.set(key, userIds, CacheTTL.LONG); // 구독 관계는 변경 빈도 낮음
  }

  async deleteCreatorSubscribersCache(creatorId: string): Promise<void> {
    const key = this.generateKey(CacheKeyType.CREATOR_SUBSCRIBERS, creatorId);
    await this.delete(key);
  }

  // ==================== 배치 캐시 무효화 메서드 ====================

  async invalidateUserInteractionCaches(userId: string): Promise<void> {
    this.logger.debug('Invalidating user interaction caches', { userId });
    
    const deleteTasks = [
      this.deleteUserInteractionCache(userId),
      this.deleteUserBookmarksCache(userId),
      this.deleteUserLikesCache(userId),
    ];

    await Promise.all(deleteTasks);
  }

  async invalidateUserSubscriptionCaches(userId: string, creatorId: string): Promise<void> {
    this.logger.debug('Invalidating user subscription caches', { userId, creatorId });
    
    const deleteTasks = [
      this.deleteUserCreatorSubscriptionsCache(userId),
      this.deleteCreatorSubscribersCache(creatorId),
    ];

    await Promise.all(deleteTasks);
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

  async invalidateReportRelatedCaches(): Promise<void> {
    this.logger.log('Invalidating report-related caches');
    await this.invalidateReportStatisticsCaches();
  }

  async invalidatePlatformApplicationRelatedCaches(): Promise<void> {
    this.logger.log('Invalidating platform application-related caches');
    await this.invalidatePlatformApplicationCaches();
  }

  // ==================== 신고 통계 캐시 메서드 ====================

  async getReportStatistics(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.REPORT_STATISTICS, 'overall');
    return this.get(key);
  }

  async setReportStatistics(statistics: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.REPORT_STATISTICS, 'overall');
    await this.set(key, statistics, CacheTTL.MEDIUM); // 30분 캐시
  }

  async getReportDistribution(distributionType: string): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, distributionType);
    return this.get(key);
  }

  async setReportDistribution(distributionType: string, distribution: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, distributionType);
    await this.set(key, distribution, CacheTTL.LONG); // 1시간 캐시
  }

  async getReportTrends(period: string): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.REPORT_TRENDS, period);
    return this.get(key);
  }

  async setReportTrends(period: string, trends: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.REPORT_TRENDS, period);
    await this.set(key, trends, CacheTTL.MEDIUM); // 30분 캐시
  }

  async invalidateReportStatisticsCaches(): Promise<void> {
    this.logger.debug('Invalidating report statistics caches');
    
    const deleteTasks = [
      this.delete(this.generateKey(CacheKeyType.REPORT_STATISTICS, 'overall')),
      this.delete(this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, 'status')),
      this.delete(this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, 'targetType')),
      this.delete(this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, 'reason')),
      this.delete(this.generateKey(CacheKeyType.REPORT_DISTRIBUTION, 'priority')),
      this.delete(this.generateKey(CacheKeyType.REPORT_TRENDS, 'monthly')),
      this.delete(this.generateKey(CacheKeyType.REPORT_TRENDS, 'daily')),
    ];

    await Promise.all(deleteTasks);
  }

  // ==================== 플랫폼 신청 캐시 메서드 ====================

  async getPlatformApplicationStats(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_STATS, 'overall');
    return this.get(key);
  }

  async setPlatformApplicationStats(stats: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_STATS, 'overall');
    await this.set(key, stats, CacheTTL.MEDIUM); // 30분 캐시
  }

  async getPlatformApplicationDistribution(distributionType: string): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_DISTRIBUTION, distributionType);
    return this.get(key);
  }

  async setPlatformApplicationDistribution(distributionType: string, distribution: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_DISTRIBUTION, distributionType);
    await this.set(key, distribution, CacheTTL.LONG); // 1시간 캐시
  }

  async getPlatformApplicationTrends(period: string): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_TRENDS, period);
    return this.get(key);
  }

  async setPlatformApplicationTrends(period: string, trends: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_TRENDS, period);
    await this.set(key, trends, CacheTTL.MEDIUM); // 30분 캐시
  }

  async getPlatformApplicationSearchResults(searchKey: string): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_SEARCH, searchKey);
    return this.get(key);
  }

  async setPlatformApplicationSearchResults(searchKey: string, results: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.PLATFORM_APPLICATION_SEARCH, searchKey);
    await this.set(key, results, CacheTTL.SHORT); // 5분 캐시
  }

  async invalidatePlatformApplicationCaches(): Promise<void> {
    this.logger.debug('Invalidating platform application caches');
    
    const deleteTasks = [
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_STATS, 'overall')),
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_DISTRIBUTION, 'status')),
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_DISTRIBUTION, 'platformType')),
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_DISTRIBUTION, 'approval')),
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_TRENDS, 'monthly-12')),
      this.delete(this.generateKey(CacheKeyType.PLATFORM_APPLICATION_TRENDS, 'monthly-6')),
    ];

    await Promise.all(deleteTasks);
  }

  // ==================== Admin Dashboard 캐시 메서드 ====================

  async getAdminDashboardStats(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_STATS, 'overall');
    return this.get(key);
  }

  async setAdminDashboardStats(stats: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_STATS, 'overall');
    await this.set(key, stats, CacheTTL.SHORT); // 5분 캐시 (대시보드 통계는 자주 업데이트)
  }

  async getAdminDashboardMetrics(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_METRICS, 'overall');
    return this.get(key);
  }

  async setAdminDashboardMetrics(metrics: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_METRICS, 'overall');
    await this.set(key, metrics, CacheTTL.SHORT); // 5분 캐시
  }

  async getAdminDashboardHealth(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_HEALTH, 'overall');
    return this.get(key);
  }

  async setAdminDashboardHealth(health: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_HEALTH, 'overall');
    await this.set(key, health, CacheTTL.SHORT / 5); // 1분 캐시 (헬스 체크는 빠른 업데이트 필요)
  }

  async getAdminDashboardOverview(): Promise<Record<string, unknown> | null> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_OVERVIEW, 'overall');
    return this.get(key);
  }

  async setAdminDashboardOverview(overview: Record<string, unknown>): Promise<void> {
    const key = this.generateKey(CacheKeyType.ADMIN_DASHBOARD_OVERVIEW, 'overall');
    await this.set(key, overview, CacheTTL.SHORT); // 5분 캐시
  }

  async invalidateAdminDashboardCaches(): Promise<void> {
    this.logger.debug('Invalidating admin dashboard caches');
    
    const deleteTasks = [
      this.delete(this.generateKey(CacheKeyType.ADMIN_DASHBOARD_STATS, 'overall')),
      this.delete(this.generateKey(CacheKeyType.ADMIN_DASHBOARD_METRICS, 'overall')),
      this.delete(this.generateKey(CacheKeyType.ADMIN_DASHBOARD_HEALTH, 'overall')),
      this.delete(this.generateKey(CacheKeyType.ADMIN_DASHBOARD_OVERVIEW, 'overall')),
    ];

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
