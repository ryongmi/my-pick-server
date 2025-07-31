import { Injectable, Logger, Inject, HttpException, forwardRef } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { EntityManager, In, UpdateResult, FindOptionsWhere, Not } from 'typeorm';
import { plainToInstance } from 'class-transformer';

import type { PaginatedResult } from '@krgeobuk/core/interfaces';

import { UserSubscriptionService } from '@modules/user-subscription/index.js';
import { ContentService } from '@modules/content/index.js';
import { VideoSyncStatus, SyncStatus } from '@common/enums/index.js';

import { CreatorRepository } from '../repositories/index.js';
import { CreatorEntity, CreatorPlatformEntity } from '../entities/index.js';
import {
  CreatorSearchQueryDto,
  CreatorSearchResultDto,
  CreatorDetailDto,
  CreateCreatorDto,
  UpdateCreatorDto,
  CreatorPlatformDto,
  AddPlatformDto,
  UpdatePlatformDto,
} from '../dto/index.js';
import { CreatorException } from '../exceptions/index.js';

import { CreatorPlatformService } from './creator-platform.service.js';

interface CreatorFilter {
  name?: string;
  category?: string;
  isVerified?: boolean;
}

@Injectable()
export class CreatorService {
  private readonly logger = new Logger(CreatorService.name);

  constructor(
    private readonly creatorRepo: CreatorRepository,
    private readonly creatorPlatformService: CreatorPlatformService,
    private readonly userSubscriptionService: UserSubscriptionService,
    private readonly contentService: ContentService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy
  ) {}

  // ==================== PUBLIC METHODS ====================

  // 기본 조회 메서드들 (BaseRepository 직접 사용)
  async findById(creatorId: string): Promise<CreatorEntity | null> {
    return this.creatorRepo.findOneById(creatorId);
  }

  async findByIdOrFail(creatorId: string): Promise<CreatorEntity> {
    const creator = await this.findById(creatorId);
    if (!creator) {
      this.logger.warn('Creator not found', { creatorId });
      throw CreatorException.creatorNotFound();
    }
    return creator;
  }

  async findByIds(creatorIds: string[]): Promise<CreatorEntity[]> {
    if (creatorIds.length === 0) return [];

    return this.creatorRepo.find({
      where: { id: In(creatorIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCategory(category: string): Promise<CreatorEntity[]> {
    return this.creatorRepo.find({
      where: { category },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAnd(filter: CreatorFilter = {}): Promise<CreatorEntity[]> {
    const where: FindOptionsWhere<CreatorEntity> = {};

    if (filter.name) where.name = filter.name;
    if (filter.category) where.category = filter.category;
    if (typeof filter.isVerified === 'boolean') where.isVerified = filter.isVerified;

    // 필터 없으면 전체 조회
    if (Object.keys(where).length === 0) {
      return this.creatorRepo.find();
    }

    return this.creatorRepo.find({ where });
  }

  async findByOr(filter: CreatorFilter = {}): Promise<CreatorEntity[]> {
    const { name, category, isVerified } = filter;

    const where: FindOptionsWhere<CreatorEntity>[] = [];

    if (name) where.push({ name });
    if (category) where.push({ category });
    if (isVerified) where.push({ isVerified });

    // ✅ 필터 없으면 전체 조회
    if (where.length === 0) {
      return this.creatorRepo.find(); // 조건 없이 전체 조회
    }

    return this.creatorRepo.find({ where });
  }

  // 복합 조회 메서드들
  async searchCreators(
    query: CreatorSearchQueryDto
  ): Promise<PaginatedResult<CreatorSearchResultDto>> {
    const creators = await this.creatorRepo.searchCreators(query);

    if (creators.items.length === 0) {
      return { items: [], pageInfo: creators.pageInfo };
    }

    const creatorIds = creators.items.map((creator) => creator.id!);

    try {
      // 🔥 병렬로 중첩 데이터 조회 (authz-server 패턴)
      const [platforms, subscriberCounts] = await Promise.all([
        this.creatorPlatformService.findByCreatorIds(creatorIds),
        this.userSubscriptionService.getSubscriberCountsByCreatorIds(creatorIds),
      ]);

      const items = this.buildCreatorSearchResults(creators.items, platforms, subscriberCounts);

      this.logger.debug('Creator search completed with enriched data', {
        totalFound: creators.pageInfo.totalItems,
        page: query.page,
        hasNameFilter: !!query.name,
        category: query.category,
        platformsCount: platforms.length,
        subscriberCountsAvailable: Object.keys(subscriberCounts).length,
      });

      return {
        items,
        pageInfo: creators.pageInfo,
      };
    } catch (error: unknown) {
      this.logger.warn('외부 데이터 조회 실패, 기본 데이터 사용', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorCount: creators.items.length,
      });

      // 🔥 폴백 처리 (authz-server 패턴)
      const items = this.buildFallbackCreatorSearchResults(creators.items);
      return {
        items,
        pageInfo: creators.pageInfo,
      };
    }
  }

  async getCreatorById(creatorId: string, userId?: string): Promise<CreatorDetailDto> {
    try {
      const creator = await this.findByIdOrFail(creatorId);

      // 🔥 플랫폼 데이터와 구독 정보 병렬 조회
      const [platforms, subscriberCount, isSubscribed] = await Promise.all([
        this.creatorPlatformService.findByCreatorId(creatorId),
        this.userSubscriptionService.getSubscriberCount(creatorId),
        userId ? this.userSubscriptionService.exists(userId, creatorId) : Promise.resolve(false),
      ]);

      // 🔥 플랫폼별 데이터 실시간 집계
      const totalFollowerCount = platforms.reduce((sum, p) => sum + (p?.followerCount ?? 0), 0);
      const totalContentCount = platforms.reduce((sum, p) => sum + (p?.contentCount ?? 0), 0);
      const totalViews = platforms.reduce((sum, p) => sum + (p?.totalViews ?? 0), 0);

      const detailDto = plainToInstance(CreatorDetailDto, creator, {
        excludeExtraneousValues: true,
      });

      // 🔥 실시간 집계된 통계 및 구독 정보 추가
      detailDto.followerCount = totalFollowerCount;
      detailDto.contentCount = totalContentCount;
      detailDto.totalViews = totalViews;
      detailDto.subscriberCount = subscriberCount;
      detailDto.isSubscribed = isSubscribed;
      detailDto.platforms = platforms;

      this.logger.debug('Creator detail fetched', {
        creatorId,
        userId,
        followerCount: totalFollowerCount,
        contentCount: totalContentCount,
        totalViews,
        subscriberCount,
        isSubscribed,
        platformCount: platforms.length,
      });

      return detailDto;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator detail fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        userId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  async getCreatorPlatforms(creatorId: string): Promise<CreatorPlatformDto[]> {
    try {
      // 1. Creator 존재 확인
      await this.findByIdOrFail(creatorId);

      // 2. 플랫폼 목록 조회
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);

      // 3. 응답 형식으로 변환
      return platforms.map((platform) => ({
        id: platform.id,
        type: platform.type,
        platformId: platform.platformId,
        url: platform.url,
        displayName: platform.displayName || '',
        followerCount: platform.followerCount,
        contentCount: platform.contentCount,
        totalViews: platform.totalViews,
        isActive: platform.isActive,
        lastSyncAt: platform.lastSyncAt,
        syncStatus: platform.syncStatus,
      }));
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator platforms fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== 권한 검증 메서드 ====================

  async isCreatorOwner(creatorId: string, userId: string): Promise<boolean> {
    try {
      const creator = await this.creatorRepo.findOneById(creatorId);
      return creator?.userId === userId;
    } catch (error: unknown) {
      this.logger.warn('Creator ownership check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        userId,
      });
      return false;
    }
  }

  async validateCreatorOwnership(creatorId: string, userId: string): Promise<void> {
    const isOwner = await this.isCreatorOwner(creatorId, userId);
    if (!isOwner) {
      this.logger.warn('Creator access denied: not owner', {
        creatorId,
        userId,
      });
      throw CreatorException.creatorAccessDenied();
    }
  }

  async findByUserId(userId: string): Promise<CreatorEntity[]> {
    try {
      return await this.creatorRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      this.logger.error('Find creators by user ID failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== 데이터 동의 관리 메서드 ====================

  /**
   * 크리에이터 데이터 수집 동의 상태 변경
   */
  async updateDataConsent(
    creatorId: string,
    hasConsent: boolean,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      const creator = await this.findByIdOrFail(creatorId);
      const now = new Date();

      // 동의 상태가 변경되었는지 확인
      const consentChanged = creator.hasDataConsent !== hasConsent;

      if (!consentChanged) {
        this.logger.debug('Data consent status unchanged', {
          creatorId,
          currentConsent: creator.hasDataConsent,
          requestedConsent: hasConsent,
        });
        return;
      }

      // 크리에이터 동의 상태 업데이트
      const updateData: Partial<CreatorEntity> = {
        hasDataConsent: hasConsent,
        lastConsentCheckAt: now,
      };

      if (hasConsent) {
        // 동의 승인 시
        updateData.consentGrantedAt = now;
        updateData.consentExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1년 후
      } else {
        // 동의 철회 시 - null을 사용하여 데이터베이스에서 null로 설정
        (updateData as any).consentGrantedAt = null;
        (updateData as any).consentExpiresAt = null;
      }

      await this.creatorRepo.update(creatorId, updateData);

      // 플랫폼별 동기화 상태 업데이트
      await this.updatePlatformSyncStatusOnConsentChange(creatorId, hasConsent, transactionManager);

      this.logger.log('Creator data consent updated successfully', {
        creatorId,
        hasConsent,
        consentGrantedAt: updateData.consentGrantedAt,
        consentExpiresAt: updateData.consentExpiresAt,
        wasChanged: consentChanged,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator data consent update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        hasConsent,
      });
      throw CreatorException.creatorUpdateError();
    }
  }

  /**
   * 동의 상태 확인 및 만료 처리
   */
  async checkConsentExpiry(creatorId: string): Promise<{
    isValid: boolean;
    isExpiringSoon: boolean;
    daysUntilExpiry?: number;
  }> {
    try {
      const creator = await this.findByIdOrFail(creatorId);

      if (!creator.hasDataConsent || !creator.consentExpiresAt) {
        return { isValid: false, isExpiringSoon: false };
      }

      const now = new Date();
      const expiryDate = creator.consentExpiresAt;
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isExpired = now > expiryDate;
      const isExpiringSoon = daysUntilExpiry <= 30; // 30일 이내 만료 예정

      if (isExpired) {
        // 동의 만료 시 자동으로 철회 처리
        await this.updateDataConsent(creatorId, false);

        this.logger.warn('Creator consent expired and revoked', {
          creatorId,
          expiryDate: expiryDate.toISOString(),
          daysOverdue: Math.abs(daysUntilExpiry),
        });

        return { isValid: false, isExpiringSoon: false };
      }

      // 마지막 확인 시점 업데이트
      await this.creatorRepo.update(creatorId, {
        lastConsentCheckAt: now,
      });

      this.logger.debug('Creator consent status checked', {
        creatorId,
        isValid: true,
        isExpiringSoon,
        daysUntilExpiry,
      });

      return {
        isValid: true,
        isExpiringSoon,
        daysUntilExpiry,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Consent expiry check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  /**
   * 만료 예정인 크리에이터들 조회
   */
  async findCreatorsWithExpiringConsent(daysThreshold = 30): Promise<CreatorEntity[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const creators = await this.creatorRepo
        .createQueryBuilder('creator')
        .where('creator.hasDataConsent = :hasConsent', { hasConsent: true })
        .andWhere('creator.consentExpiresAt <= :thresholdDate', { thresholdDate })
        .orderBy('creator.consentExpiresAt', 'ASC')
        .getMany();

      this.logger.debug('Found creators with expiring consent', {
        count: creators.length,
        daysThreshold,
        thresholdDate: thresholdDate.toISOString(),
      });

      return creators;
    } catch (error: unknown) {
      this.logger.error('Failed to find creators with expiring consent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysThreshold,
      });
      throw CreatorException.creatorFetchError();
    }
  }

  /**
   * 동의 상태 일괄 갱신 (스케줄러에서 사용)
   */
  async batchUpdateConsentStatus(): Promise<{
    expiredCount: number;
    expiringSoonCount: number;
    totalChecked: number;
  }> {
    try {
      // 동의한 크리에이터 모두 조회
      const consentedCreators = await this.creatorRepo.find({
        where: { hasDataConsent: true },
      });

      let expiredCount = 0;
      let expiringSoonCount = 0;
      const totalChecked = consentedCreators.length;

      for (const creator of consentedCreators) {
        try {
          const status = await this.checkConsentExpiry(creator.id);

          if (!status.isValid) {
            expiredCount++;
          } else if (status.isExpiringSoon) {
            expiringSoonCount++;
          }
        } catch (error: unknown) {
          this.logger.warn('Individual consent check failed during batch update', {
            error: error instanceof Error ? error.message : 'Unknown error',
            creatorId: creator.id,
          });
        }
      }

      this.logger.log('Batch consent status update completed', {
        totalChecked,
        expiredCount,
        expiringSoonCount,
      });

      return { expiredCount, expiringSoonCount, totalChecked };
    } catch (error: unknown) {
      this.logger.error('Batch consent status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw CreatorException.creatorFetchError();
    }
  }

  // ==================== 변경 메서드 ====================

  async createCreator(dto: CreateCreatorDto, transactionManager?: EntityManager): Promise<void> {
    try {
      // 1. 사전 검증 (비즈니스 규칙) - authz-server 패턴 적용
      if (dto.name && dto.category) {
        const existingCreator = await this.creatorRepo.findOne({
          where: { name: dto.name, category: dto.category },
        });

        if (existingCreator) {
          this.logger.warn('Creator creation failed: duplicate name', {
            name: dto.name,
            category: dto.category,
          });
          throw CreatorException.creatorAlreadyExists();
        }
      }

      // 2. 엔티티 생성
      const creatorEntity = new CreatorEntity();
      Object.assign(creatorEntity, dto);

      // 3. Creator 저장
      const creator = await this.creatorRepo.saveEntity(creatorEntity, transactionManager);

      // 4. 플랫폼 정보 배치 생성 및 저장
      if (dto.platforms && dto.platforms.length > 0) {
        await this.creatorPlatformService.addMultiplePlatformsToCreator(
          creator.id,
          dto.platforms,
          transactionManager
        );
      }

      // 5. 성공 로깅
      this.logger.log('Creator created successfully', {
        creatorId: creator.id,
        userId: dto.userId,
        name: dto.name,
        category: dto.category,
        platformCount: dto.platforms?.length || 0,
      });
    } catch (error: unknown) {
      // 4. 에러 처리 및 로깅
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: dto.userId,
        name: dto.name,
        category: dto.category,
      });

      throw CreatorException.creatorCreateError();
    }
  }

  async updateCreator(
    creatorId: string,
    dto: UpdateCreatorDto,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // BaseRepository 직접 사용 - authz-server 패턴
      const creator = await this.creatorRepo.findOneById(creatorId);

      if (!creator) {
        this.logger.warn('Creator update failed: creator not found', { creatorId });
        throw CreatorException.creatorNotFound();
      }

      // 이름 변경 시 중복 체크 (authz-server 패턴)
      if (dto.name && dto.name !== creator.name) {
        const existingCreator = await this.creatorRepo.findOne({
          where: {
            name: dto.name,
            category: creator.category,
            id: Not(creatorId), // 현재 크리에이터 제외
          },
        });

        if (existingCreator) {
          this.logger.warn('Creator update failed: duplicate name', {
            creatorId,
            newName: dto.name,
            category: creator.category,
          });
          throw CreatorException.creatorAlreadyExists();
        }
      }

      // 업데이트할 필드만 변경
      Object.assign(creator, dto);
      await this.creatorRepo.saveEntity(creator, transactionManager);

      this.logger.log('Creator updated successfully', {
        creatorId,
        name: creator.name,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        updatedFields: Object.keys(dto),
      });

      throw CreatorException.creatorUpdateError();
    }
  }

  async deleteCreator(creatorId: string): Promise<UpdateResult> {
    try {
      // BaseRepository 직접 사용 - authz-server 패턴
      const creator = await this.creatorRepo.findOneById(creatorId);

      if (!creator) {
        this.logger.warn('Creator deletion failed: creator not found', { creatorId });
        throw CreatorException.creatorNotFound();
      }

      // 🔥 관련 데이터 삭제 전 확인 및 정리
      const [subscriberCount, platforms] = await Promise.all([
        this.userSubscriptionService.getSubscriberCount(creatorId),
        this.creatorPlatformService.findByCreatorId(creatorId),
      ]);

      // 🔥 플랫폼별 콘텐츠 수 집계
      const totalContentCount = platforms.reduce((sum, p) => sum + p.contentCount, 0);

      this.logger.log('Creator deletion initiated', {
        creatorId,
        creatorName: creator.name,
        subscriberCount,
        contentCount: totalContentCount,
        platformCount: platforms.length,
      });

      // 관련 데이터가 있어도 소프트 삭제로 진행 (참조 무결성 유지)

      const result = await this.creatorRepo.softDelete(creatorId);

      this.logger.log('Creator deleted successfully', {
        creatorId,
        name: creator.name,
        category: creator.category,
        deletionType: 'soft',
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Creator deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      throw CreatorException.creatorDeleteError();
    }
  }

  /**
   * 동의 상태 변경 시 플랫폼 동기화 상태 업데이트
   */
  private async updatePlatformSyncStatusOnConsentChange(
    creatorId: string,
    hasConsent: boolean,
    transactionManager?: EntityManager
  ): Promise<void> {
    try {
      // 동의 상태에 따른 동기화 상태 결정
      const updateData = hasConsent
        ? {
            // 동의 승인 시: 전체 재동기화 필요
            videoSyncStatus: VideoSyncStatus.CONSENT_CHANGED,
          }
        : {
            // 동의 철회 시: 증분 동기화로 전환 (데이터 수집 중단)
            videoSyncStatus: VideoSyncStatus.INCREMENTAL,
          };

      // CreatorPlatformService를 통한 일괄 업데이트
      await this.creatorPlatformService.updatePlatformSyncStatusByCreatorId(
        creatorId,
        updateData,
        transactionManager
      );

      this.logger.debug('Platform sync status updated for consent change', {
        creatorId,
        hasConsent,
        newSyncStatus: updateData.videoSyncStatus,
      });
    } catch (error: unknown) {
      this.logger.error('Failed to update platform sync status on consent change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        hasConsent,
      });
      // 주요 동의 업데이트를 막지 않기 위해 예외를 던지지 않음
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  // 🔥 중첩 구조로 결과 빌드 (실시간 집계 기반)
  private buildCreatorSearchResults(
    creators: Partial<CreatorEntity>[],
    platforms: CreatorPlatformEntity[],
    subscriberCounts: Record<string, number> = {}
  ): CreatorSearchResultDto[] {
    return creators.map((creator) => {
      const creatorPlatforms = platforms.filter((p) => p.creatorId === creator.id);

      // 🔥 플랫폼별 데이터 실시간 집계
      const totalFollowerCount = creatorPlatforms.reduce((sum, p) => sum + p.followerCount, 0);
      const totalContentCount = creatorPlatforms.reduce((sum, p) => sum + p.contentCount, 0);
      const totalViews = creatorPlatforms.reduce((sum, p) => sum + p.totalViews, 0);
      const subscriberCount = subscriberCounts[creator.id!] || 0;

      return {
        id: creator.id!,
        name: creator.name!,
        displayName: creator.displayName!,
        avatar: creator.avatar || '',
        description: creator.description || undefined,
        isVerified: creator.isVerified!,
        followerCount: totalFollowerCount, // 🔥 실시간 집계된 팔로워 수
        subscriberCount, // 🔥 실시간 계산된 구독자 수
        contentCount: totalContentCount, // 🔥 실시간 집계된 콘텐츠 수
        totalViews: totalViews, // 🔥 실시간 집계된 총 조회수
        category: creator.category!,
        tags: creator.tags || undefined,
        platforms: creatorPlatforms.map((p) => ({
          // 🔥 중첩 플랫폼 정보
          id: p.id,
          type: p.type,
          platformId: p.platformId,
          url: p.url,
          followerCount: p.followerCount,
          contentCount: p.contentCount, // 🔥 플랫폼별 콘텐츠 수
          totalViews: p.totalViews, // 🔥 플랫폼별 총 조회수
          isActive: p.isActive,
        })),
        createdAt: creator.createdAt!,
      };
    });
  }

  // 🔥 폴백 처리 결과 빌드 (실시간 집계 기반)
  private buildFallbackCreatorSearchResults(
    creators: Partial<CreatorEntity>[]
  ): CreatorSearchResultDto[] {
    return creators.map((creator) => ({
      id: creator.id!,
      name: creator.name!,
      displayName: creator.displayName!,
      avatar: creator.avatar || '',
      description: creator.description,
      isVerified: creator.isVerified!,
      followerCount: 0, // 🔥 플랫폼 데이터 없을 때 기본값
      subscriberCount: 0, // 🔥 기본값으로 폴백
      contentCount: 0, // 🔥 플랫폼 데이터 없을 때 기본값
      totalViews: 0, // 🔥 플랫폼 데이터 없을 때 기본값
      category: creator.category!,
      tags: creator.tags || undefined,
      platforms: [], // 🔥 빈 배열로 폴백
      createdAt: creator.createdAt!,
    }));
  }

  // ==================== PLATFORM 관리 메서드 (관리자 전용) ====================

  async addPlatformToCreator(creatorId: string, dto: AddPlatformDto): Promise<void> {
    try {
      await this.creatorPlatformService.addPlatformToCreator(creatorId, dto);

      this.logger.log('Platform added to creator via admin', {
        creatorId,
        platformType: dto.type,
        platformId: dto.platformId,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Add platform to creator failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
        platformType: dto.type,
      });
      throw CreatorException.platformCreateError();
    }
  }

  async updateCreatorPlatform(platformId: string, dto: UpdatePlatformDto): Promise<void> {
    try {
      await this.creatorPlatformService.updateCreatorPlatform(platformId, dto);

      this.logger.log('Creator platform updated via admin', {
        platformId,
        updatedFields: Object.keys(dto),
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Update creator platform failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.platformUpdateError();
    }
  }

  async removeCreatorPlatform(platformId: string): Promise<void> {
    try {
      // 플랫폼 존재 확인
      const platform = await this.creatorPlatformService.findByIdOrFail(platformId);

      // 플랫폼 삭제
      await this.creatorPlatformService.deleteCreatorPlatform(platformId);

      this.logger.log('Creator platform removed via admin', {
        platformId,
        creatorId: platform.creatorId,
        platformType: platform.type,
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Remove creator platform failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.platformDeleteError();
    }
  }

  async syncPlatformData(platformId: string): Promise<void> {
    try {
      // 플랫폼 존재 확인
      const platform = await this.creatorPlatformService.findByIdOrFail(platformId);

      // 동기화 상태 업데이트
      await this.creatorPlatformService.updateSyncStatus(platformId, {
        syncStatus: SyncStatus.ACTIVE,
      });

      this.logger.log('Platform data sync triggered via admin', {
        platformId,
        creatorId: platform.creatorId,
        platformType: platform.type,
      });

      // TODO: 실제 외부 API 동기화 로직 구현
      // - YouTube Data API 호출
      // - Twitter API 호출
      // - 통계 데이터 업데이트
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Platform data sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        platformId,
      });
      throw CreatorException.platformSyncError();
    }
  }

  // ==================== 통계 메서드 ====================

  async getCreatorStatistics(creatorId: string): Promise<{
    followerCount: number;
    contentCount: number;
    totalViews: number;
  }> {
    try {
      // CreatorPlatform에서 followerCount 총합 계산
      const platforms = await this.creatorPlatformService.findByCreatorId(creatorId);
      const followerCount = platforms.reduce(
        (sum: number, platform) => sum + (platform.followerCount || 0),
        0
      );

      // Content 개수와 총 조회수 계산 (TCP 통신 사용)
      const [contentCount, totalViews] = await Promise.all([
        this.getContentCount(creatorId),
        this.getTotalViews(creatorId),
      ]);

      this.logger.debug('Creator statistics calculated', {
        creatorId,
        followerCount,
        contentCount,
        totalViews,
        platformCount: platforms.length,
      });

      return {
        followerCount,
        contentCount,
        totalViews,
      };
    } catch (error: unknown) {
      this.logger.error('Creator statistics calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });

      // 에러 발생 시 기본값 반환 (서비스 안정성)
      return {
        followerCount: 0,
        contentCount: 0,
        totalViews: 0,
      };
    }
  }

  private async getContentCount(creatorId: string): Promise<number> {
    try {
      return await this.contentService.getContentCountByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to get content count from content service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  private async getTotalViews(creatorId: string): Promise<number> {
    try {
      // ContentService에 총 조회수 메서드 호출
      return await this.contentService.getTotalViewsByCreatorId(creatorId);
    } catch (error: unknown) {
      this.logger.warn('Failed to get total views from content service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        creatorId,
      });
      return 0;
    }
  }

  // ==================== ADMIN 통계 메서드 ====================

  async getTotalCount(): Promise<number> {
    try {
      return await this.creatorRepo.getTotalCount();
    } catch (error: unknown) {
      this.logger.error('Failed to get total creator count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

