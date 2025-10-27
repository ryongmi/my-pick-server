import { Injectable, Logger, HttpException } from '@nestjs/common';

import { EntityManager, In, UpdateResult, Not } from 'typeorm';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { CacheService } from '@database/redis/index.js';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity, ConsentType } from '../entities/index.js';
import { CreatorException } from '../exceptions/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
} from '../dto/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';
import { CreatorConsentService } from './creator-consent.service.js';

interface PlatformStats {
  totalFollowers: number;
  totalContent: number;
  totalViews: number;
  platformCount: number;
}

interface CreatorStatistics {
  followerCount: number;
  contentCount: number;
  totalViews: number;
  avgEngagementRate: number;
  platformCount: number;
  lastSyncAt?: Date | undefined;
}

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly creatorConsentService: CreatorConsentService,
    private readonly cacheService: CacheService
  ) {}

  // ==================== PUBLIC METHODS ====================

  async findById(creatorId: string): Promise<CreatorEntity | null> {
    return this.creatorRepo.findOne({ where: { id: creatorId } });
  }

  async findByIdOrFail(creatorId: string): Promise<CreatorEntity> {
    const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });

    if (!creator) {
      this.logger.debug('Creator not found', { creatorId });
      throw CreatorException.creatorNotFound();
    }

    return creator;
  }

  async findByIds(creatorIds: string[]): Promise<CreatorEntity[]> {
    if (creatorIds.length === 0) return [];

    return await this.creatorRepo.find({
      where: { id: In(creatorIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<CreatorEntity | null> {
    return this.creatorRepo.findOne({ where: { userId } });
  }

  async findByCategory(category: string): Promise<CreatorEntity[]> {
    return this.creatorRepo.find({
      where: { category },
      order: { createdAt: 'DESC' },
    });
  }

  async searchCreators(query: CreatorSearchQueryDto): Promise<PaginatedResult<CreatorSearchResultDto>> {
    try {
      const result = await this.creatorRepo.searchCreators(query);
      return {
        items: this.buildCreatorSearchResults(result.items),
        pageInfo: result.pageInfo,
      };
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator search', { query }, CreatorException.creatorFetchError);
    }
  }

  async getCreatorById(creatorId: string): Promise<CreatorDetailDto> {
    try {
      // 캐시 조회
      const cached = await this.cacheService.getCreatorDetail(creatorId);
      if (cached) return cached;

      // DB 조회 및 DTO 생성
      const creator = await this.findByIdOrFail(creatorId);
      const platformStats = await this.getPlatformStatsWithCache(creatorId);
      const detailDto = this.buildCreatorDetail(creator, platformStats);

      // 결과 캐싱
      await this.cacheService.setCreatorDetail(creatorId, detailDto);
      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.handleServiceError(error, 'Creator detail fetch', { creatorId }, CreatorException.creatorFetchError);
    }
  }

  // ==================== 변경 메서드 ====================

  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<string> {
    try {
      // 중복 검증
      if (dto.name && dto.category) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { name: dto.name, category: dto.category },
        });
        if (existingCreator) throw CreatorException.creatorAlreadyExists();
      }

      // 엔티티 생성 및 저장
      const creatorEntity = new CreatorEntity();
      Object.assign(creatorEntity, dto);
      await this.creatorRepo.saveEntity(creatorEntity, transactionManager);

      // 캐시 무효화
      await this.cacheService.invalidateCreatorRelatedCaches(creatorEntity.id);
      return creatorEntity.id;
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator creation', { name: dto.name, category: dto.category }, CreatorException.creatorCreateError);
    }
  }

  async updateCreator(creatorId: string, dto: UpdateCreatorDto, transactionManager?: EntityManager): Promise<void> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });
      if (!creator) throw CreatorException.creatorNotFound();

      // 표시명 중복 체크
      if (dto.displayName && dto.displayName !== creator.displayName) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { displayName: dto.displayName, category: creator.category, id: Not(creatorId) },
        });
        if (existingCreator) throw CreatorException.creatorAlreadyExists();
      }

      // 업데이트 및 캐시 무효화
      Object.assign(creator, dto);
      await this.creatorRepo.updateEntity(creator, transactionManager);
      await this.cacheService.invalidateCreatorRelatedCaches(creatorId);
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator update', { creatorId, updatedFields: Object.keys(dto) }, CreatorException.creatorUpdateError);
    }
  }

  async deleteCreator(creatorId: string): Promise<UpdateResult> {
    try {
      const creator = await this.creatorRepo.findOne({ where: { id: creatorId } });
      if (!creator) throw CreatorException.creatorNotFound();

      const result = await this.creatorRepo.softDelete(creatorId);
      await this.cacheService.invalidateCreatorRelatedCaches(creatorId);
      return result;
    } catch (error: unknown) {
      this.handleServiceError(error, 'Creator deletion', { creatorId }, CreatorException.creatorDeleteError);
    }
  }

  async updateCreatorStatus(
    creatorId: string,
    status: 'active' | 'inactive' | 'suspended' | 'banned',
    reason?: string,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const creator = await this.findByIdOrFail(creatorId);

      // 상태 변경
      creator.status = status;

      // 비활성/정지/밴 상태인 경우 마지막 활동 시간 업데이트
      if (status !== 'active') {
        creator.lastActivityAt = new Date();
      }

      await this.creatorRepo.updateEntity(creator, transactionManager);
      await this.cacheService.invalidateCreatorRelatedCaches(creatorId);

      this.logger.log('Creator status updated successfully', {
        creatorId,
        newStatus: status,
        reason,
      });
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Creator status update',
        { creatorId, status, reason },
        CreatorException.creatorUpdateError
      );
    }
  }

  // ==================== 동의 관리 메서드 (위임) ====================

  async hasValidConsents(creatorId: string): Promise<boolean> {
    return this.creatorConsentService.hasAnyConsent(creatorId);
  }

  async getActiveConsents(creatorId: string): Promise<ConsentType[]> {
    return this.creatorConsentService.getActiveConsents(creatorId);
  }

  async getActiveConsentsBatch(creatorIds: string[]): Promise<Record<string, ConsentType[]>> {
    return this.creatorConsentService.getActiveConsentsBatch(creatorIds);
  }

  // ==================== 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    return this.creatorRepo.count();
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private handleServiceError(
    error: unknown,
    operation: string,
    context: Record<string, unknown>,
    fallbackException: () => HttpException
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    throw fallbackException();
  }

  private async getPlatformStatsWithCache(creatorId: string): Promise<PlatformStats> {
    let stats = await this.cacheService.getPlatformStats(creatorId);
    if (!stats) {
      stats = await this.buildDetailedPlatformStats(creatorId);
      await this.cacheService.setPlatformStats(creatorId, stats);
    }
    return stats;
  }

  private async buildDetailedPlatformStats(creatorId: string): Promise<PlatformStats> {
    try {
      return await this.creatorPlatformService.getStatsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to fetch platform stats', { creatorId, error });
      return { totalFollowers: 0, totalContent: 0, totalViews: 0, platformCount: 0 };
    }
  }

  private buildCreatorDetail(creator: CreatorEntity, platformStats: PlatformStats): CreatorDetailDto {
    const result: CreatorDetailDto = {
      id: creator.id,
      name: creator.name,
      displayName: creator.displayName,
      isVerified: creator.isVerified,
      category: creator.category,
      status: creator.status,
      verificationStatus: creator.verificationStatus,
      platformStats: {
        totalFollowers: platformStats.totalFollowers,
        totalContent: platformStats.totalContent,
        totalViews: platformStats.totalViews,
        platformCount: platformStats.platformCount,
      },
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };

    // 조건부 할당 (간소화)
    const optionalFields = {
      userId: creator.userId,
      avatar: creator.avatar,
      description: creator.description,
      tags: creator.tags,
      lastActivityAt: creator.lastActivityAt,
      socialLinks: creator.socialLinks,
    };

    Object.entries(optionalFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        (result as unknown as Record<string, unknown>)[key] = value;
      }
    });

    return result;
  }

  // ==================== STATISTICS AND PERFORMANCE METHODS ====================

  async getCreatorStatistics(creatorId: string): Promise<CreatorStatistics> {
    try {
      // 캐시 키 생성
      const cacheKey = `creator:stats:${creatorId}`;
      
      // 캐시에서 먼저 조회 시도
      const cachedStats = await this.cacheService.get<CreatorStatistics>(cacheKey);
      if (cachedStats) {
        this.logger.debug('Creator statistics fetched from cache', { creatorId });
        return cachedStats;
      }

      // 크리에이터 존재 확인
      await this.findByIdOrFail(creatorId);

      // 플랫폼 통계를 병렬로 조회하여 성능 최적화
      const [platforms, platformStats] = await Promise.all([
        this.creatorPlatformService.findByCreatorId(creatorId),
        this.calculatePlatformStats(creatorId),
      ]);

      const lastSyncAt = this.getLastSyncTime(platforms);
      const statistics: CreatorStatistics = {
        followerCount: platformStats.totalFollowers,
        contentCount: platformStats.totalContent,
        totalViews: platformStats.totalViews,
        avgEngagementRate: await this.calculateEngagementRate(creatorId, platformStats),
        platformCount: platforms.length,
        ...(lastSyncAt && { lastSyncAt }),
      };

      // 통계를 캐시에 저장 (5분 TTL)
      await this.cacheService.set(cacheKey, statistics, 300);

      this.logger.log('Creator statistics calculated and cached', {
        creatorId,
        platformCount: statistics.platformCount,
        contentCount: statistics.contentCount,
      });

      return statistics;
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Creator statistics calculation',
        { creatorId },
        CreatorException.creatorFetchError
      );
    }
  }

  async getCreatorPlatforms(creatorId: string): Promise<Array<{
    id: string;
    type: string;
    platformId: string;
    url: string;
    displayName?: string | undefined;
    followerCount: number;
    contentCount: number;
    totalViews: number;
    isActive: boolean;
    lastSyncAt?: Date | undefined;
    syncStatus: string;
  }>> {
    try {
      // 크리에이터 존재 확인
      await this.findByIdOrFail(creatorId);

      // 플랫폼 정보 조회
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);

      // 각 플랫폼의 상세 통계를 병렬로 조회
      const platformDetails = await Promise.all(
        platforms.map(async (platform) => {
          const stats = await this.getPlatformStatistics(platform.id);
          return {
            id: platform.id,
            type: platform.type,
            platformId: platform.platformId,
            url: platform.url || '',
            displayName: platform.displayName || undefined,
            followerCount: stats.followerCount || 0,
            contentCount: stats.contentCount || 0,
            totalViews: stats.totalViews || 0,
            isActive: platform.isActive,
            lastSyncAt: platform.lastSyncAt || undefined,
            syncStatus: this.determineSyncStatus(platform.lastSyncAt || undefined, platform.isActive),
          };
        })
      );

      this.logger.debug('Creator platforms fetched successfully', {
        creatorId,
        platformCount: platformDetails.length,
      });

      return platformDetails;
    } catch (error: unknown) {
      this.handleServiceError(
        error,
        'Creator platforms fetch',
        { creatorId },
        CreatorException.creatorFetchError
      );
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async calculatePlatformStats(creatorId: string): Promise<PlatformStats> {
    try {
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
      
      const stats = await Promise.all(
        platforms.map(async (platform) => {
          const platformStats = await this.getPlatformStatistics(platform.id);
          return {
            followers: platformStats.followerCount || 0,
            content: platformStats.contentCount || 0,
            views: platformStats.totalViews || 0,
          };
        })
      );

      return {
        totalFollowers: stats.reduce((sum, stat) => sum + stat.followers, 0),
        totalContent: stats.reduce((sum, stat) => sum + stat.content, 0),
        totalViews: stats.reduce((sum, stat) => sum + stat.views, 0),
        platformCount: platforms.length,
      };
    } catch (error: unknown) {
      this.logger.warn('Failed to calculate platform stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return {
        totalFollowers: 0,
        totalContent: 0,
        totalViews: 0,
        platformCount: 0,
      };
    }
  }

  private async getPlatformStatistics(platformId: string): Promise<{
    followerCount?: number;
    contentCount?: number;
    totalViews?: number;
  }> {
    try {
      // 플랫폼별 통계는 향후 구현될 ExternalApiService나 별도 통계 서비스에서 조회
      // 현재는 기본값 반환
      return {
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
      };
    } catch (error: unknown) {
      this.logger.debug('Platform statistics not available', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      return {};
    }
  }

  private async calculateEngagementRate(creatorId: string, platformStats: PlatformStats): Promise<number> {
    try {
      if (platformStats.totalViews === 0) return 0;

      // 참여율 계산은 향후 Content 도메인과 User-Interaction 도메인 연동으로 개선
      // 현재는 기본 계산 로직 사용
      const estimatedEngagements = Math.floor(platformStats.totalViews * 0.05); // 5% 추정
      return Math.round((estimatedEngagements / platformStats.totalViews) * 10000) / 100; // 소수점 2자리
    } catch (error: unknown) {
      this.logger.debug('Engagement rate calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  private getLastSyncTime(platforms: Array<{ lastSyncAt?: Date | null }>): Date | undefined {
    const syncTimes = platforms
      .map(p => p.lastSyncAt)
      .filter((time): time is Date => time !== undefined && time !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    return syncTimes.length > 0 ? syncTimes[0] : undefined;
  }

  private determineSyncStatus(lastSyncAt?: Date, isActive?: boolean): string {
    if (!isActive) return 'inactive';
    if (!lastSyncAt) return 'never_synced';

    const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync < 24) return 'up_to_date';
    if (hoursSinceSync < 72) return 'slightly_outdated';
    return 'outdated';
  }

  private buildCreatorSearchResults(creators: Partial<CreatorEntity>[]): CreatorSearchResultDto[] {
    return creators.map((creator) => ({
      id: creator.id!,
      name: creator.name!,
      displayName: creator.displayName!,
      avatar: creator.avatar,
      description: creator.description,
      isVerified: creator.isVerified!,
      category: creator.category!,
      tags: creator.tags,
      createdAt: creator.createdAt!,
    }));
  }
}
